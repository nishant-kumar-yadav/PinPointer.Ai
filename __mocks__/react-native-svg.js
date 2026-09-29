/**
 * Mock of react-native-svg — stub components that render nothing.
 * Covers every named export used in src/ (Svg default + Path/Circle/Rect).
 */
const makeStub = (name) => {
  const C = (props) => null;
  C.displayName = name;
  return C;
};

const Svg = makeStub('Svg');

module.exports = {
  __esModule: true,
  default: Svg,
  Svg,
  Path: makeStub('Path'),
  Circle: makeStub('Circle'),
  Rect: makeStub('Rect'),
  G: makeStub('G'),
  Line: makeStub('Line'),
  Text: makeStub('SvgText'),
  TSpan: makeStub('TSpan'),
  Defs: makeStub('Defs'),
  LinearGradient: makeStub('SvgLinearGradient'),
  Stop: makeStub('Stop'),
  Ellipse: makeStub('Ellipse'),
  Polygon: makeStub('Polygon'),
  Polyline: makeStub('Polyline'),
};
