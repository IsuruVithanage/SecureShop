/**
 *
 * Button
 *
 */

import React from 'react';
import PropTypes from 'prop-types';

import Tooltip from '../Tooltip';
import Popover from '../Popover';

const variants = {
  primary: 'custom-btn-primary',
  secondary: 'custom-btn-secondary',
  danger: 'custom-btn-danger',
  link: 'custom-btn-link',
  dark: 'custom-btn-dark',
  none: 'custom-btn-none',
  empty: ''
};

const Button = props => {
  const {
    id,
    size,
    variant,
    tabIndex,
    ariaLabel,
    ariaExpanded,
    type,
    disabled,
    className,
    text,
    role,
    icon,
    iconDirection,
    iconClassName,
    borderless,
    round,
    onClick,
    tooltip,
    tooltipContent,
    popover,
    popoverContent,
    popoverTitle
  } = props;

  const v = variant ? variants[variant] : '';

  const btnVariant = v;

  const btn =
    icon && text ? 'with-icon' : icon && !text ? 'icon-only' : 'text-only';

  const classNames = `input-btn${`${className && ` ${className}`}`}${
    btnVariant && ` ${btnVariant}`
  }${` ${size}`} ${btn} ${
    iconDirection === 'left' ? 'icon-left' : 'icon-right'
  } ${borderless ? 'border-0' : ''}`;

  const iconClassNames = `btn-icon${`${iconClassName && ` ${iconClassName}`}`}`;

  const tooltipId = tooltip ? `tooltip-${id}` : id;
  const popoverId = popover ? `popover-${id}` : id;
  const btnId = tooltip ? tooltipId : popoverId;

  return (
    <button
      id={btnId}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      role={role}
      disabled={disabled}
      className={classNames}
      type={type}
      onClick={onClick}
      style={{
        borderRadius: round
      }}
    >
      {tooltip && <Tooltip target={tooltipId}>{tooltipContent}</Tooltip>}
      {popover && (
        <Popover target={popoverId} popoverTitle={popoverTitle}>
          {popoverContent}
        </Popover>
      )}
      {iconDirection === 'left' ? (
        <>
          {icon && <div className={iconClassNames}>{icon}</div>}
          {text && <span className='btn-text'>{text}</span>}
        </>
      ) : (
        <>
          {text && <span className='btn-text'>{text}</span>}
          {icon && <div className={iconClassNames}>{icon}</div>}
        </>
      )}
    </button>
  );
};

Button.propTypes = {
  id: PropTypes.string,
  size: PropTypes.string,
  variant: PropTypes.string,
  tabIndex: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  ariaLabel: PropTypes.string,
  ariaExpanded: PropTypes.bool,
  type: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  text: PropTypes.string,
  role: PropTypes.string,
  icon: PropTypes.node,
  iconDirection: PropTypes.string,
  iconClassName: PropTypes.string,
  borderless: PropTypes.bool,
  round: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onClick: PropTypes.func,
  tooltip: PropTypes.bool,
  tooltipContent: PropTypes.node,
  popover: PropTypes.bool,
  popoverContent: PropTypes.node,
  popoverTitle: PropTypes.string
};

Button.defaultProps = {
  type: 'button',
  variant: 'secondary',
  size: 'md',
  className: '',
  iconDirection: 'left',
  iconClassName: '',
  borderless: false,
  round: 3,
  tooltip: false,
  popover: false
};

export default Button;
