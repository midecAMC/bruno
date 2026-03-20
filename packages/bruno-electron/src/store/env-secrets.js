const _ = require('lodash');
const Store = require('electron-store');
const { encryptStringSafe } = require('../utils/encryption');

const posixifyPath = (p) => (p ? p.replace(/\\/g, '/') : p);

const getSecretOccurrence = (variables = [], targetIndex) => {
  const target = variables[targetIndex];
  if (!target) {
    return 0;
  }

  let occurrence = 0;
  for (let index = 0; index <= targetIndex; index += 1) {
    const variable = variables[index];
    if (variable?.secret && variable?.name === target.name) {
      occurrence += 1;
    }
  }

  return occurrence;
};

/**
 * Sample secrets store file
 *
 * {
 *   "collections": [{
 *     "path": "/Users/anoop/Code/acme-acpi-collection",
 *     "environments" : [{
 *       "name": "Local",
 *       "secrets": [{
 *         "name": "token",
 *         "value": "abracadabra"
 *       }]
 *     }]
 *   }]
 * }
 */

class EnvironmentSecretsStore {
  constructor() {
    this.store = new Store({
      name: 'secrets',
      clearInvalidConfig: true
    });
  }

  storeEnvSecrets(collectionPathname, environment) {
    const normalizedPathname = posixifyPath(collectionPathname);
    const envVars = [];
    _.each(environment.variables, (v, index) => {
      if (v.secret) {
        envVars.push({
          name: v.name,
          occurrence: getSecretOccurrence(environment.variables, index),
          value: encryptStringSafe(v.value).value
        });
      }
    });

    const collections = this.store.get('collections') || [];
    const collection = _.find(collections, (c) => posixifyPath(c.path) === normalizedPathname);

    // if collection doesn't exist, create it, add the environment and save
    if (!collection) {
      collections.push({
        path: normalizedPathname,
        environments: [
          {
            name: environment.name,
            secrets: envVars
          }
        ]
      });

      this.store.set('collections', collections);
      return;
    }

    collection.path = normalizedPathname;

    // if collection exists, check if environment exists
    // if environment doesn't exist, add the environment and save
    collection.environments = collection.environments || [];
    const env = _.find(collection.environments, (e) => e.name === environment.name);
    if (!env) {
      collection.environments.push({
        name: environment.name,
        secrets: envVars
      });

      this.store.set('collections', collections);
      return;
    }

    // if environment exists, update the secrets and save
    env.secrets = envVars;
    this.store.set('collections', collections);
  }

  getEnvSecrets(collectionPathname, environment) {
    const normalizedPathname = posixifyPath(collectionPathname);
    const collections = this.store.get('collections') || [];
    const collection = _.find(collections, (c) => posixifyPath(c.path) === normalizedPathname);
    if (!collection) {
      return [];
    }

    const env = _.find(collection.environments, (e) => e.name === environment.name);
    if (!env) {
      return [];
    }

    return env.secrets || [];
  }

  renameEnvironment(collectionPathname, oldName, newName) {
    const normalizedPathname = posixifyPath(collectionPathname);
    const collections = this.store.get('collections') || [];
    const collection = _.find(collections, (c) => posixifyPath(c.path) === normalizedPathname);
    if (!collection) {
      return;
    }

    const env = _.find(collection.environments, (e) => e.name === oldName);
    if (!env) {
      return;
    }

    env.name = newName;
    this.store.set('collections', collections);
  }

  deleteEnvironment(collectionPathname, environmentName) {
    const normalizedPathname = posixifyPath(collectionPathname);
    const collections = this.store.get('collections') || [];
    const collection = _.find(collections, (c) => posixifyPath(c.path) === normalizedPathname);
    if (!collection) {
      return;
    }

    _.remove(collection.environments, (e) => e.name === environmentName);
    this.store.set('collections', collections);
  }
}

module.exports = EnvironmentSecretsStore;
