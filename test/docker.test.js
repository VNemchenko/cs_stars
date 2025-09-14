import assert from 'node:assert/strict';
import { test } from 'node:test';
import { substituteStartup, buildDockerRun } from '../server.mjs';

test('substituteStartup replaces placeholders', () => {
  const cmd = substituteStartup('start ${PORT} and {{HOST}}', { PORT: 1234, HOST: 'example' });
  assert.equal(cmd, 'start 1234 and example');
});

test('buildDockerRun supplies default startup and port mapping', () => {
  const { args, startupCmd } = buildDockerRun({ slug: 'test', docker_image: 'alpine' }, { SERVER_PORT: 27015 });
  assert.equal(startupCmd, 'echo "No startup provided"');
  const portUdp = '27015:27015/udp';
  const portTcp = '27015:27015/tcp';
  assert.ok(args.includes(portUdp));
  assert.ok(args.includes(portTcp));
  assert.equal(args.at(-1), startupCmd);
});
