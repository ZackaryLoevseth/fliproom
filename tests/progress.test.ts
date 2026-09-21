import test from 'node:test';
import assert from 'node:assert/strict';
import {planSignature, toggleStep, validProgress} from '../src/lib/progress';
import type {Catalog, Step} from '../src/lib/types';

const step = (id: string, dependsOn: string[] = []): Step => ({id,itemId: id,kind:'move',label:id,from:null,to:null,dependsOn,minutes:1});
const steps = [step('a'), step('b',['a']), step('c',['b']), step('d')];
test('reject checkmarks without completed prerequisite and unknown IDs', () => {
  assert.deepEqual(validProgress(steps, ['b','c','bad','d']), ['d']);
  assert.deepEqual(validProgress(steps, null), []);
});
test('completion refuses a blocked step; undo clears dependent descendants', () => {
  assert.deepEqual(toggleStep(steps, [], 'c'), []);
  assert.deepEqual(toggleStep(steps, ['a','b','c','d'], 'a'), ['d']);
  assert.deepEqual(toggleStep(steps, ['a'], 'b'), ['a','b']);
});
test('catalog edits change saved-plan identity even when scene IDs stay fixed', () => {
  const catalog: Catalog = {room:{id:'r',name:'Room',width:12,height:8},items:[],scenes:[]};
  assert.notEqual(planSignature(catalog,'a','b'), planSignature({...catalog,room:{...catalog.room,width:10}},'a','b'));
  assert.notEqual(planSignature(catalog,'a','b'), planSignature(catalog,'b','a'));
});
