'use strict';

const { opendir, readFile } = require('node:fs/promises');
const PATH_SEP = require('node:path').sep;

let meshserver;
let monitoring;
let prometheus;

let cgroupRootPath;
let metricNamePrefix;
let collectorName;
const metrics ={};

const LXC_PAYLOAD_PREFIX = 'lxc.payload.';
const LXC_PAYLOAD_PREFIX_LENGTH = LXC_PAYLOAD_PREFIX.length;
const SERVICE_SUFFIX = '.service';
const SERVICE_SUFFIX_LENGTH = SERVICE_SUFFIX.length;
const PSI_SUFFIX = '.pressure';
const MEMORY_CURRENT = 'memory.current';
const MEMORY_SWAP_CURRENT = 'memory.swap.current';
const SYSTEM_SLICE = 'system.slice';

const psiControllerNames = [ 'cpu', 'io' ];
const psiScopeNames = [ 'some', 'full' ];
const psiValueNames = [ 'avg10', 'avg60', 'avg300', 'total' ];

const metricLabelNames = [ 'container_name', 'service_name' ];

async function collectCgroupMetrics(cgroupPath, containerName, serviceName) {
  const labels = { container_name: containerName, service_name: serviceName };
  const readFileOptions = { encoding: 'ascii' };
  let value;
  value = +( await readFile(cgroupPath + PATH_SEP + MEMORY_CURRENT, readFileOptions));
  metrics.memoryCurrent.set(labels, value);
  value = +( await readFile(cgroupPath + PATH_SEP + MEMORY_SWAP_CURRENT, readFileOptions));
  metrics.memorySwapCurrent.set(labels, value);
  for (let controllerName of psiControllerNames) {
    const controllerMetrics = metrics[controllerName];
    const lines = (await readFile(cgroupPath + PATH_SEP + controllerName + PSI_SUFFIX, readFileOptions)).split('\n');
    lines.pop(); // remove the trailing empty line
    for (let line of lines) {
      const parts = line.split(' ');
      const scope = parts.shift();
      const scope_metrics = controllerMetrics[scope];
      for (let part of parts) {
        let [ valueName, value ] = part.split('=');
        value = +value;
        scope_metrics[valueName].set(labels, value);
      }
    };
  }
}

async function collectLxcContainerMetrics() {
  const startTs = Date.now();
  const cgroupRootDir = await opendir(cgroupRootPath);
  for await (const containerDirent of cgroupRootDir) {
    if (!containerDirent.isDirectory() || !containerDirent.name.startsWith(LXC_PAYLOAD_PREFIX)) {
      continue;
    }
    const containerPath = cgroupRootPath + PATH_SEP + containerDirent.name;
    const containerName = containerDirent.name.slice(LXC_PAYLOAD_PREFIX_LENGTH);
    collectCgroupMetrics(containerPath, containerName, '');
    const slicePath = containerPath + PATH_SEP + SYSTEM_SLICE;
    const sliceDir = await opendir(slicePath);
    for await (const sliceDirent of sliceDir) {
      if (!sliceDirent.isDirectory() || !sliceDirent.name.endsWith(SERVICE_SUFFIX)) {
        continue;
      }
      const servicePath = slicePath + PATH_SEP + sliceDirent.name;
      const serviceName = sliceDirent.name.slice(0, sliceDirent.name.length - SERVICE_SUFFIX_LENGTH);
      collectCgroupMetrics(servicePath, containerName, serviceName);
    }
  }
  const endTs = Date.now();
  const duration = (endTs - startTs) / 1000;
  metrics.nodeCollectorDuration.labels(collectorName).set(duration);
  metrics.nodeCollectorSuccess.labels(collectorName).set(1);
  metrics.duration.labels(collectorName).set(duration);
}

function setupLxcContainerMetrics() {
  metrics.nodeCollectorDuration = new prometheus.Gauge({
    name: 'node_scrape_collector_duration_seconds',
    help: 'foobar',
    labelNames: [ 'collector' ],
  });
  metrics.nodeCollectorSuccess = new prometheus.Gauge({
    name: 'node_scrape_collector_success',
    help: 'foobar',
    labelNames: [ 'collector' ],
  });
  metrics.duration = new prometheus.Gauge({
    name: metricNamePrefix + '_scrape_collector_duration_seconds',
    help: 'foobar',
    labelNames: [ 'collector' ],
  });
  metrics.memoryCurrent = new prometheus.Gauge({
    name: metricNamePrefix + '_memory_current_bytes',
    help: 'Currently used memory',
    labelNames: metricLabelNames,
  });
  metrics.memorySwapCurrent = new prometheus.Gauge({
    name: metricNamePrefix + '_memory_swap_current_bytes',
    help: 'Currently used swap memory',
    labelNames: metricLabelNames,
  });
  for (let controllerName of psiControllerNames) {
    const obj1 = metrics[controllerName] ??= {};
    for (let scopeName of psiScopeNames) {
      const obj2 = obj1[scopeName] ??= {};
      for (let valueName of psiValueNames) {
        obj2[valueName] = new prometheus.Gauge({
          name: metricNamePrefix + `_${controllerName}_pressure_${scopeName}_${valueName}`,
          help: `Pressure (${scopeName}) ${valueName}`,
          labelNames: metricLabelNames
        });
      }
    }
  }
}

module.exports.lxc_monitoring = function (parent) {
  meshserver = parent.parent;
  var obj = {};
  obj.server_startup = async function() {
    const buffer = await readFile(__filename.replace(/\.js$/, '.conf.json'));
    const config = JSON.parse(buffer.toString());
    ({ collectorName, metricNamePrefix, cgroupRootPath } = config );
    monitoring = meshserver.monitoring;
    prometheus = monitoring.prometheus;
    setupLxcContainerMetrics();
    monitoring.collectors.push(collectLxcContainerMetrics);
  }
  return obj;
}
