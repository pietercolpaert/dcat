import { strictEqual } from 'assert'
import { describe, it, run } from 'mocha'
import normalize from '../index.js'
import rdf from './support/factory.js'
import { listToArray, readFileContent, readFileDataset } from './support/utils.js'

const ns = {
  action: rdf.namedNode('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#action'),
  entries: rdf.namedNode('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#entries'),
  result: rdf.namedNode('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#result')
}

const exclude = new Set([
  'manifest-urdna2015#test023',
  'manifest-urdna2015#test044',
  'manifest-urdna2015#test045',
  'manifest-urdna2015#test046',
  'manifest-urdna2015#test057'
])

async function loadTest (dataset, term) {
  if (exclude.has(term.value)) {
    return null
  }

  const action = [...dataset.match(term, ns.action)][0].object.value
  const result = [...dataset.match(term, ns.result)][0].object.value
  const input = await readFileDataset(action)
  const expected = await readFileContent(result)

  return () => {
    it('should pass test ' + term.value, () => {
      const actual = normalize(input)

      strictEqual(actual, expected)
    })
  }
}

async function loadTests (filename) {
  const dataset = await readFileDataset(filename)

  const entryTerm = [...dataset.match(null, ns.entries)][0].object
  const testTerms = listToArray(dataset, entryTerm)
  const tests = []

  for (const testTerm of testTerms) {
    tests.push(await loadTest(dataset, testTerm))
  }

  return tests.filter(Boolean)
}

loadTests('manifest-urdna2015.ttl').then(tests => {
  describe('@rdfjs/normalize', () => {
    describe('RDF Dataset Normalization (URDNA2015)', () => {
      for (const test of tests) {
        test()
      }
    })
  })

  run()
})
