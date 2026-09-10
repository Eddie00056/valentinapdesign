import { EXPIRIES } from "./mock";
import { Menu, MenuItem } from "./ui";
import { Check, Stepper } from "./icons";

/**
 * Expiry selector.
 *
 * Every expiry carries its days-to-expiry inline, so the term structure is
 * legible from the list itself rather than from date arithmetic. The one
 * expiry straddling the next report is flagged with an E — implied
 * volatility is usually elevated into it and drops right after.
 */
export function ExpiryPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selected = EXPIRIES.find((e) => e.id === selectedId) ?? EXPIRIES[0];

  return (
    <Menu
      label="Expiry"
      width="max-content"
      direction="right"
      triggerClass="oc-exp-btn"
      renderTrigger={() => (
        <>
          <span>
            Exp {selected.label} ({selected.dte}D)
          </span>
          <Stepper size={12} />
        </>
      )}
    >
      {EXPIRIES.map((e) => (
        <MenuItem
          key={e.id}
          label={`${e.label}, ${e.dte} days to expiry`}
          onClick={() => onSelect(e.id)}
        >
          <span className="oc-exp-label">
            {e.label} ({e.dte}D)
          </span>
          <span className="oc-exp-marks">
            {e.isEarnings && (
              <span className="oc-exp-e" title="Earnings before this expiry">
                E
              </span>
            )}
            {e.id === selectedId && <Check size={12} />}
          </span>
        </MenuItem>
      ))}
    </Menu>
  );
}
