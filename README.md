# MeshCentral-LXC_Monitoring

Export metrics for LXC containers and running services within them with the MeshCentral monitoring module.

## cgroup filesystem

Set the `cgroupRootPath` in `lxc_monitoring.conf.json` to the directory where the cgroup2-fs is mounted.

If MeshCentral is running on bare metal this might be `/sys/fs/cgroup`, if running inside a container you might bind-mount it anywhere.

- `mount -o bind /sys/fs/cgroup /var/lib/lxc/meshcentral--develop/rootfs/media/lxc-host-cgroup/`
- `mount | grep cgroup`
  ```
  cgroup2 on /sys/fs/cgroup type cgroup2 (rw,nosuid,nodev,noexec,relatime)
  cgroup2 on /var/lib/lxc/meshcentral--develop/rootfs/media/lxc-host-cgroup type cgroup2 (rw,nosuid,nodev,noexec,relatime)
  ```
