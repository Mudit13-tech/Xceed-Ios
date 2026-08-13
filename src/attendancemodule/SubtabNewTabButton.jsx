import PropTypes from 'prop-types';
import { openSubtabInNewTab } from './subtabNavigation';

export default function SubtabNewTabButton({
  value,
  label,
  queryKey = 'tab',
  extraParams = {},
  active = false,
  style,
}) {
  return (
    <button
      type="button"
      className="ams-subtab-newtab-btn"
      aria-label={`Open ${label} in new tab`}
      title={`Open ${label} in new tab`}
      onClick={(event) => {
        event.stopPropagation();
        openSubtabInNewTab(value, queryKey, extraParams);
      }}
      style={{
        width: 28,
        minWidth: 28,
        padding: 0,
        border: 'none',
        borderLeft: '1px solid rgba(123,132,171,0.18)',
        borderRadius: '0 7px 7px 0',
        background: active ? '#ffffff' : 'transparent',
        color: active ? '#6366f1' : '#7b84ab',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 17,
        fontWeight: 600,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <span aria-hidden="true">+</span>
    </button>
  );
}

SubtabNewTabButton.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
  queryKey: PropTypes.string,
  extraParams: PropTypes.object,
  active: PropTypes.bool,
  style: PropTypes.object,
};

export function AmsSubtab({ value, label, active, onSelect, queryKey = 'tab', extraParams = {} }) {
  return (
    <span
      className={`ams-subtab-option${active ? ' active' : ''}`}
      style={{ display: 'inline-flex', alignItems: 'stretch', flexShrink: 0 }}
    >
      <button
        type="button"
        className={`ams-tab${active ? ' active' : ''}`}
        onClick={() => onSelect(value)}
        style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
      >
        {label}
      </button>
      <SubtabNewTabButton
        value={value}
        label={label}
        queryKey={queryKey}
        extraParams={extraParams}
        active={active}
      />
    </span>
  );
}

AmsSubtab.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
  active: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  queryKey: PropTypes.string,
  extraParams: PropTypes.object,
};
