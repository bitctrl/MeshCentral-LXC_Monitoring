# MeshCentral-LXC_Monitoring

Export metrics for LXC containers and running services within them with the
[MeshCentral](https://github.com/Ylianst/MeshCentral) monitoring module.

## Installation

Pre-requisite: First, make sure you have plugins and the monitoring module
enabled for your MeshCentral installation:
```json
    "plugins": {
         "enabled": true
    },
    "prometheus": true,
```
Restart your MeshCentral server after making this change.

 To install, simply add the plugin configuration URL when prompted:
 `https://raw.githubusercontent.com/bitctrl/MeshCentral-LXC_Monitoring/refs/heads/main/config.json`

 After installation copy the configuration template and adapt it to your needs.
 Restart your MeshCentral server again after making this change.

## cgroup filesystem

Set the `cgroupRootPath` in `lxc_monitoring.conf.json` to the directory where the cgroup2-fs is mounted.

If MeshCentral is running on bare metal this might be `/sys/fs/cgroup`, if running inside a container you might bind-mount it anywhere.

- `mount -o bind /sys/fs/cgroup /var/lib/lxc/meshcentral--develop/rootfs/media/lxc-host-cgroup/`
- `mount | grep cgroup`
  ```
  cgroup2 on /sys/fs/cgroup type cgroup2 (rw,nosuid,nodev,noexec,relatime)
  cgroup2 on /var/lib/lxc/meshcentral--develop/rootfs/media/lxc-host-cgroup type cgroup2 (rw,nosuid,nodev,noexec,relatime)
  ```

## Performance

The evaluated data comes from The Kernel and is well documented. To reduce the
time required for collecting the metrics we expect the data is delivered as
described.

- [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html)
- [PSI - Pressure Stall Information](https://docs.kernel.org/accounting/psi.html)

### Measurements

On a smaller host with 5 containers and 55 services (60 cgroups) where the
development was done the duration was reduced from 0.0.1 to 0.0.2 from 23ms to
14ms (60%) per scrape. The equivalent bash script for the node_exporters'
textfile collector takes 44ms.

On a bigger host with 25 containers and 184 services (209 cgroups, 3.5 times)
used for comparison the bash script takes about 160ms (3.6 times). If we apply
the factor 3.5 to this pluging it would take 80ms in version 0.0.1 and 49ms in
version 0.0.2 on each scrape.

`avg_over_time(bitctrl_lxc_scrape_collector_duration_seconds{collector="bitctrl_lxc",instance=~"(bcs-lxc-(16|64)-one|meshcentral-playground).*"}[120m] @1739487600)`

```
{collector="bitctrl_lxc", instance="meshcentral-playground:9464", job="meshcentral"}	0.02238333333333333
{collector="bitctrl_lxc", instance="bcs-lxc-16-one:9100", job="nodeexporter"}	        0.043978025000000004
{collector="bitctrl_lxc", instance="bcs-lxc-64-one:9100", job="nodeexporter"}	        0.167014575
```

```
{collector="bitctrl_lxc", instance="meshcentral-playground:9464", job="meshcentral"}	0.013825
{collector="bitctrl_lxc", instance="bcs-lxc-16-one:9100", job="nodeexporter"}	        0.04408181666666667
{collector="bitctrl_lxc", instance="bcs-lxc-64-one:9100", job="nodeexporter"}	        0.15913569166666666
```
