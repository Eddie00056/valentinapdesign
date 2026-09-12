// Encode a directory of JPEG frames to an H.264 MP4 with AVFoundation.
// macOS has no ffmpeg; AVAssetWriter does the same job with nothing to install.
//
//   swift scripts/encode.swift <frames-dir> <out.mp4> <fps> <width> <height> <bitrate>
//
// Frames are read in name order (000000.jpg, 000001.jpg, ...), already placed on
// a constant-rate timeline by the caller, and scaled to width x height.
import AVFoundation
import AppKit
import CoreVideo

let a = CommandLine.arguments
guard a.count == 7, let fps = Int32(a[3]), let W = Int(a[4]), let H = Int(a[5]), let bitrate = Int(a[6]) else {
  FileHandle.standardError.write("usage: encode.swift <frames> <out.mp4> <fps> <w> <h> <bitrate>\n".data(using: .utf8)!)
  exit(2)
}
let dir = URL(fileURLWithPath: a[1])
let out = URL(fileURLWithPath: a[2])
try? FileManager.default.removeItem(at: out)

let files = try FileManager.default.contentsOfDirectory(atPath: dir.path)
  .filter { $0.hasSuffix(".jpg") }.sorted()

let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: W,
  AVVideoHeightKey: H,
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: bitrate,
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    AVVideoMaxKeyFrameIntervalKey: Int(fps) * 2,
    AVVideoAllowFrameReorderingKey: true,
  ],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
  kCVPixelBufferWidthKey as String: W,
  kCVPixelBufferHeightKey as String: H,
])
writer.add(input)
// moov atom up front, so a <video> can start playing before it has the whole file
writer.shouldOptimizeForNetworkUse = true
writer.startWriting()
writer.startSession(atSourceTime: .zero)

let space = CGColorSpaceCreateDeviceRGB()
for (i, name) in files.enumerated() {
  guard let img = NSImage(contentsOf: dir.appendingPathComponent(name)),
        let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
  var pb: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
  guard let buf = pb else { continue }
  CVPixelBufferLockBaseAddress(buf, [])
  let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: W, height: H, bitsPerComponent: 8,
                      bytesPerRow: CVPixelBufferGetBytesPerRow(buf), space: space,
                      bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  ctx.interpolationQuality = .high
  ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
  CVPixelBufferUnlockBaseAddress(buf, [])
  while !input.isReadyForMoreMediaData { usleep(2000) }
  adaptor.append(buf, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps))
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed {
  FileHandle.standardError.write("failed: \(String(describing: writer.error))\n".data(using: .utf8)!)
  exit(1)
}
print("\(files.count) frames")
