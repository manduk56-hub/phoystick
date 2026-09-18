import test from 'node:test';
import assert from 'node:assert/strict';
import {mapAim,validCalibration,CALIBRATION_TARGETS} from '../lib/aim.ts';
const wrap=n=>((n+540)%360)-180;
for(const inverted of [false,true])test('five-point mapping with '+(inverted?'inverted':'normal')+' sensor axes and yaw wrap',()=>{
 const points=CALIBRATION_TARGETS.map(p=>({yaw:wrap(178+(p.x-.5)*(inverted?-60:60)+(p.y-.5)*6),pitch:10+(p.y-.5)*(inverted?40:-40)}));
 assert.equal(validCalibration(points),true);
 for(let i=0;i<5;i++){const actual=mapAim(points[i],points);assert.ok(Math.abs(actual.x-CALIBRATION_TARGETS[i].x)<1e-8);assert.ok(Math.abs(actual.y-CALIBRATION_TARGETS[i].y)<1e-8)}
 const upper=mapAim({yaw:wrap(178-.2*6),pitch:10-.2*(inverted?40:-40)},points);assert.ok(upper.y<.5);
});
test('duplicate and crossed corners are rejected',()=>{
 const p=[{yaw:0,pitch:0},{yaw:-20,pitch:15},{yaw:20,pitch:15},{yaw:20,pitch:-15},{yaw:-20,pitch:-15}];
 assert.equal(validCalibration(p),true);
 assert.equal(validCalibration([p[0],p[1],p[1],p[3],p[4]]),false);
 assert.equal(validCalibration([p[0],p[1],p[3],p[2],p[4]]),false);
 const edge=mapAim({yaw:70,pitch:0},p);assert.equal(edge.x,1);
});
