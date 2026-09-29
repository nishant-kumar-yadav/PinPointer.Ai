/**
 * Mock of react-native-gesture-handler — passthrough root view.
 */
const React = require('react');

const GestureHandlerRootView = (props) =>
  React.createElement(React.Fragment, null, props.children);

module.exports = {
  GestureHandlerRootView,
  State: { UNDETERMINED: 0, BEGAN: 1, ACTIVE: 4, END: 5 },
  Directions: { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 },
  default: { GestureHandlerRootView },
};
