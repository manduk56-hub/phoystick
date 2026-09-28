import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { WheelControl, gravityFromOrientation, idleInput } from '../lib/racing-model.ts';

// Run the controller's real callbacks with browser events and time controlled.
const source = readFileSync(new URL('../app/racing/racing.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('racing.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const controller = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'Controller');
const callbacks = {};
function visit(node) {
  if (ts.isVariableDeclaration(node) && ['onSensor', 'hidden', 'orientation'].includes(node.name.getText(ast))) {
    callbacks[node.name.getText(ast)] = node.initializer.getText(ast);
  }
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'setInterval') {
    callbacks.tick = node.arguments[0].getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(controller);
function setup() {
  const ref = current => ({ current });
  const events = [];
  const context = vm.createContext({
    wheel: ref(new WheelControl()), gravity: ref(null), enabled: ref(true),
    touchMode: ref(false), touchInput: ref(idleInput()), drive: ref(idleInput()),
    link: ref(null), events: ref([]), lastStatus: ref(0),
    document: { hidden: false }, media: { matches: true },
    gravityFromOrientation, idleInput, Date,
    sendEvent: action => events.push(action),
    setLandscape() {}, setCalibrated() {}, setSample() {}, setInput() {}, setLive() {},
  });
  for (const [name, callback] of Object.entries(callbacks)) {
    const code = ts.transpileModule(`const callback = ${callback};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    context[name] = vm.runInContext(`(() => { ${code} return callback; })()`, context);
  }
  return { context, events };
}

test('a held sensor pose continues accelerating without further orientation events', () => {
  const { context: c } = setup();
  c.onSensor({ beta: 0, gamma: 70 });
  assert.equal(c.wheel.current.calibrate(c.gravity.current), true);
  c.onSensor({ beta: 0, gamma: 45 });
  for (let i = 0; i < 30; i++) c.tick();
  assert.ok(c.drive.current.throttle > 0.999);
  assert.equal(c.drive.current.brake, 0);
});

test('rotation and backgrounding invalidate the old pose and hold the race', () => {
  for (const action of ['orientation', 'hidden']) {
    const { context: c, events } = setup();
    c.onSensor({ beta: 0, gamma: 70 });
    c.wheel.current.calibrate(c.gravity.current);
    if (action === 'hidden') c.document.hidden = true;
    c[action]();
    c.tick();
    assert.equal(c.gravity.current, null);
    assert.equal(c.wheel.current.baseline, null);
    assert.equal(c.drive.current.throttle, 0);
    assert.equal(c.drive.current.brake, 1);
    assert.ok(events.includes('hold'));
  }
});
