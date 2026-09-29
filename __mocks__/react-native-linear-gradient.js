/**
 * Mock of react-native-linear-gradient — renders children inside a View
 * so layout/behavior tests keep working without the native view.
 */
const React = require('react');
const { View } = require('react-native');

const LinearGradient = React.forwardRef((props, ref) =>
  React.createElement(View, { ...props, ref, testID: props.testID || 'linear-gradient' }, props.children),
);
LinearGradient.displayName = 'LinearGradient';

module.exports = { __esModule: true, default: LinearGradient };
module.exports.LinearGradient = LinearGradient;
