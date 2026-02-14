/**
 *
 * Badge
 *
 */

import React from 'react';
import PropTypes from 'prop-types';

const variants = {
  primary: 'custom-badge-primary',
  secondary: 'custom-badge-secondary',
  danger: 'custom-badge-danger',
  dark: 'custom-badge-dark',
  none: 'custom-badge-none',
  empty: ''
};

const Badge = props => {
  const { variant, className, borderless, round, children } = props;

  const v = variant ? variants[variant] : '';

  const classNames = [
    'custom-badge',
    className,
    v
  ].filter(Boolean).join(' ');

  return (
    <span
      className={classNames}
      style={{
        borderRadius: borderless ? 0 : round
      }}
    >
      {children}
    </span>
  );
};

Badge.propTypes = {
  variant: PropTypes.oneOf([
    'primary',
    'secondary',
    'danger',
    'dark',
    'none',
    'empty'
  ]),
  className: PropTypes.string,
  borderless: PropTypes.bool,
  round: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Handles '3' or 3
  children: PropTypes.node
};

Badge.defaultProps = {
  variant: 'secondary',
  className: '',
  borderless: false,
  round: 3
};

export default Badge;
