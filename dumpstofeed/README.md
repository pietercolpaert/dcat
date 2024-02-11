# From DCAT-AP dumps to feeds

When no state is provided, the script is going to extract all entities and mention them as `as:Create`s. When a state is already present, it is going to compare all entities with a fingerprint and check whether the set of triples changed, and whether the entity is still present. New entities can also be added.

Clone the repo, fetch a dataset, and execute `ts-node bin/dumpsToFeed.ts`.

Parameters:
 * `feedname` for the state and building a relative IRI
 * `filename` of the dump

Options:
 * `--flush` clears the state

## Datasets to use

Example workflows:
 * See [workflow of Flanders](workflow-flanders.sh)
 * See [workflow of Sweden](workflow-sweden.sh)