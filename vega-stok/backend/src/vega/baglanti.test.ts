import assert from 'node:assert/strict'
import { test } from 'node:test'
import { saltOkunurDogrula } from './baglanti'

test('SELECT ve WITH kabul edilir', () => {
  saltOkunurDogrula('SELECT * FROM T WITH (NOLOCK)')
  saltOkunurDogrula('  -- açıklama\n WITH x AS (SELECT 1 AS a) SELECT a FROM x')
  saltOkunurDogrula("SELECT 1 WHERE ad = 'DELETE; DROP'")
})

test('yazma ve çoklu ifade reddedilir', () => {
  for (const kotu of [
    'UPDATE T SET a = 1',
    'DELETE FROM T',
    'SELECT * INTO yedek FROM T',
    'SELECT 1; DROP TABLE T',
    'EXEC sp_who',
    'WITH x AS (SELECT 1 AS a) DELETE FROM T',
    '/* SELECT */ TRUNCATE TABLE T',
  ]) {
    assert.throws(() => saltOkunurDogrula(kotu), Error, kotu)
  }
})
