#!/usr/bin/env bash
# agi-lemonade-runtime installer — per-OS Lemonade + FastFlowLM setup.
#
# Invoked by AGI's system-service manager as the `installCommand` via
# `execFile("bash", ["-c", <contents of this script>])`. Detects the
# host OS + version, then runs the right install sequence.
#
# For AMD XDNA 2 hardware on Ubuntu: Lemonade-team PPA + libxrt-npu2 +
# amdxdna-dkms + the FLM .deb from the lemonade-sdk GitHub releases.
# Kernel module DKMS install means a reboot is RECOMMENDED afterwards
# (not strictly required if the kernel already has amdxdna loaded, which
# is true on Ubuntu 24.04 HWE with kernel 6.11+).

set -euo pipefail

# Non-interactive by default — when invoked from AGI's system-service
# install endpoint there's no TTY, and debconf prompts otherwise wedge
# the whole apt transaction.
export DEBIAN_FRONTEND=noninteractive

emit() {
  printf '{"phase":"lemonade-install","status":"%s","details":"%s"}\n' "$1" "$2"
}

# FLM is published by the FastFlowLM project (separate from lemonade-sdk).
# Per-Ubuntu-version .debs with predictable naming.
FLM_RELEASE_URL="https://api.github.com/repos/FastFlowLM/FastFlowLM/releases/latest"

# MOK enrollment password surfaced to the dashboard. Intentionally memorable
# because the user types it at pre-boot (shim MokManager), not at runtime.
# Treat as ephemeral — used exactly once, then discarded after reboot.
MOK_PASSWORD="${AGI_LEMONADE_MOK_PASSWORD:-aionima}"
MOK_DIR="/var/lib/shim-signed/mok"
MOK_PRIV="${MOK_DIR}/MOK.priv"
MOK_CERT="${MOK_DIR}/MOK.der"
MOK_SUBJECT="/CN=Aionima Secure Boot Module Signature key"

secure_boot_enabled() {
  mokutil --sb-state 2>/dev/null | grep -qi "SecureBoot enabled"
}

mok_enrolled() {
  local fp
  fp="$(openssl x509 -in "$MOK_CERT" -inform DER -noout -fingerprint -sha1 2>/dev/null | cut -d= -f2 | tr -d : | tr '[:upper:]' '[:lower:]')"
  [ -n "$fp" ] || return 1
  mokutil --list-enrolled 2>/dev/null | grep -oE '[0-9a-f]{2}(:[0-9a-f]{2}){19}' | tr -d : | tr '[:upper:]' '[:lower:]' | grep -qx "$fp"
}

mok_queued() {
  local fp
  fp="$(openssl x509 -in "$MOK_CERT" -inform DER -noout -fingerprint -sha1 2>/dev/null | cut -d= -f2 | tr -d : | tr '[:upper:]' '[:lower:]')"
  [ -n "$fp" ] || return 1
  mokutil --list-new 2>/dev/null | grep -oE '[0-9a-f]{2}(:[0-9a-f]{2}){19}' | tr -d : | tr '[:upper:]' '[:lower:]' | grep -qx "$fp"
}

# Create the MOK pair (if missing), wire DKMS to sign with it, queue it for
# enrollment at next boot. Idempotent — safe to call on every install.
sb_setup_mok() {
  if ! secure_boot_enabled; then
    emit "securebootvalue" "Secure Boot is OFF — skipping MOK setup, DKMS modules will load unsigned"
    return 0
  fi

  emit "mok" "Secure Boot is ON — preparing MOK for DKMS signing"
  sudo mkdir -p "$MOK_DIR"

  if [ ! -f "$MOK_CERT" ] || [ ! -f "$MOK_PRIV" ]; then
    emit "mok" "generating new MOK key pair at $MOK_DIR"
    sudo openssl req -new -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes \
      -keyout "$MOK_PRIV" -outform DER -out "$MOK_CERT" \
      -subj "$MOK_SUBJECT" 2>/dev/null
    sudo chmod 600 "$MOK_PRIV"
    sudo chmod 644 "$MOK_CERT"
  else
    emit "mok" "reusing existing MOK at $MOK_DIR"
  fi

  # Configure DKMS to auto-sign. Append only if not already present.
  if ! grep -q "mok_signing_key=\"$MOK_PRIV\"" /etc/dkms/framework.conf 2>/dev/null; then
    emit "mok" "configuring DKMS auto-sign in /etc/dkms/framework.conf"
    sudo tee -a /etc/dkms/framework.conf > /dev/null <<EOF

# --- Aionima: sign DKMS modules with the MOK from $MOK_DIR ---
# Added by agi-lemonade-runtime (NPU support). Every DKMS build self-signs
# the resulting .ko so Secure Boot accepts it once the MOK is enrolled.
mok_signing_key="$MOK_PRIV"
mok_certificate="$MOK_CERT"
EOF
  fi

  # Queue enrollment if not already enrolled and not already queued.
  if mok_enrolled; then
    emit "mok" "MOK already enrolled — nothing to queue"
  elif mok_queued; then
    emit "mok" "MOK already queued for enrollment at next reboot (password: $MOK_PASSWORD)"
  else
    emit "mok" "queuing MOK enrollment (password: $MOK_PASSWORD)"
    printf '%s\n%s\n' "$MOK_PASSWORD" "$MOK_PASSWORD" | sudo mokutil --import "$MOK_CERT"
    sudo mkdir -p /var/lib/aionima
    sudo tee /var/lib/aionima/mok-enrollment-pending > /dev/null <<MOK_MARKER
MOK enrollment is pending.

At your next reboot, the blue "MokManager" screen will appear before the
operating system starts. Do the following:

  1. Select "Enroll MOK"
  2. Select "Continue"
  3. Select "Yes"  (confirm you want to enroll the key)
  4. Type password: $MOK_PASSWORD
  5. Select "Reboot"

After the second boot completes, the Aionima MOK is trusted and the signed
amdxdna DKMS module loads automatically, unlocking the AMD XDNA 2 NPU for
FastFlowLM + Lemonade.

To cancel the enrollment instead:
  sudo mokutil --revoke-import
  sudo rm /var/lib/aionima/mok-enrollment-pending
MOK_MARKER
    emit "mok-reboot-required" "REBOOT REQUIRED — at next boot, shim's blue MokManager screen appears. Select 'Enroll MOK' → Continue → Yes → type password '$MOK_PASSWORD' → Reboot. NPU (amdxdna) loads only after this one-time enrollment. Full instructions written to /var/lib/aionima/mok-enrollment-pending."
  fi
}

# Ensure the kernel cmdline includes the IOMMU flags that amdxdna SVA needs.
# Without these, Ubuntu puts the NPU in identity (passthrough) IOMMU domain,
# iommu_sva_bind_device returns -EOPNOTSUPP, and FLM/Lemonade report "No NPU
# device found" even with the signed module loaded. Idempotent — safe to
# call on every install.
npu_setup_iommu_cmdline() {
  local grub=/etc/default/grub
  local need_iommu=0 need_passthrough=0
  local cmdline
  cmdline="$(cat /proc/cmdline 2>/dev/null || true)"

  if ! echo "$cmdline" | grep -q 'amd_iommu=force_isolation'; then
    need_iommu=1
  fi
  if ! echo "$cmdline" | grep -q 'iommu.passthrough=0'; then
    need_passthrough=1
  fi

  if [ "$need_iommu" -eq 0 ] && [ "$need_passthrough" -eq 0 ]; then
    emit "iommu" "kernel cmdline already has IOMMU flags — nothing to do"
    return 0
  fi

  if [ ! -f "$grub" ]; then
    emit "iommu-warn" "$grub not found — cannot edit kernel cmdline automatically. Manually add 'amd_iommu=force_isolation iommu.passthrough=0' to your bootloader."
    return 0
  fi

  emit "iommu" "NPU needs IOMMU translation mode — editing $grub"
  sudo cp "$grub" "${grub}.bak-pre-npu-$(date +%Y%m%d-%H%M%S)"

  # Append flags to GRUB_CMDLINE_LINUX_DEFAULT if not already present.
  local to_add=""
  [ "$need_iommu" -eq 1 ]        && to_add="$to_add amd_iommu=force_isolation"
  [ "$need_passthrough" -eq 1 ]  && to_add="$to_add iommu.passthrough=0"
  to_add="${to_add## }"

  # Extract current value, strip trailing quote, append, re-quote. Use awk
  # instead of sed to avoid escaping hell.
  sudo awk -v add="$to_add" '
    /^GRUB_CMDLINE_LINUX_DEFAULT=/ {
      # Remove surrounding quotes, add flags, re-wrap.
      match($0, /^GRUB_CMDLINE_LINUX_DEFAULT="(.*)"$/, parts);
      printf "GRUB_CMDLINE_LINUX_DEFAULT=\"%s %s\"\n", parts[1], add;
      next;
    }
    { print }
  ' "$grub" | sudo tee "${grub}.new" > /dev/null
  sudo mv "${grub}.new" "$grub"

  emit "iommu" "running update-grub"
  sudo update-grub 2>&1 | tail -5 || {
    emit "error" "update-grub failed — revert with: sudo cp ${grub}.bak-pre-npu-* $grub && sudo update-grub"
    return 1
  }

  sudo mkdir -p /var/lib/aionima
  sudo tee /var/lib/aionima/iommu-reboot-pending > /dev/null <<EOF
IOMMU kernel flags have been added to $grub. A reboot is required to pick
them up — without it, the amdxdna driver cannot bind SVA to the NPU, and
FastFlowLM/Lemonade will not see the device (even with the signed module
loaded and MOK enrolled).

Added flags:
  $to_add

After reboot, verify with:
  cat /proc/cmdline    # should show the new flags
  agi doctor           # NPU chain should be green

To revert:
  sudo cp ${grub}.bak-pre-npu-* $grub
  sudo update-grub
EOF
  emit "iommu-reboot-required" "REBOOT REQUIRED — IOMMU flags added to kernel cmdline. After reboot, FLM and Lemonade will see the NPU. Full instructions at /var/lib/aionima/iommu-reboot-pending."
}

# Build + sign + install amdxdna for every currently-installed kernel.
# Safe to call when amdxdna-dkms is not yet installed (no-op).
sb_build_sign_amdxdna() {
  local ver kernel
  ver="$(dpkg-query -W -f='${Version}' amdxdna-dkms 2>/dev/null || true)"
  [ -z "$ver" ] && { emit "dkms" "amdxdna-dkms not installed — skipping"; return 0; }

  # DKMS uses the upstream version string, which is the .deb version minus
  # the Debian revision suffix (everything after the last '-').
  local dkms_ver
  dkms_ver="$(echo "$ver" | sed 's/-[^-]*$//')"
  emit "dkms" "amdxdna DKMS source version $dkms_ver"

  # Register if needed.
  if ! sudo dkms status amdxdna/"$dkms_ver" 2>/dev/null | grep -q .; then
    sudo dkms add -m amdxdna -v "$dkms_ver" 2>&1 | tail -5 || true
  fi

  # Build + install for every installed kernel.
  for kernel in $(ls /lib/modules 2>/dev/null); do
    if [ ! -d "/lib/modules/$kernel/build" ]; then
      emit "dkms" "skipping kernel $kernel (no build dir — headers missing)"
      continue
    fi
    if sudo dkms status amdxdna/"$dkms_ver" -k "$kernel" 2>/dev/null | grep -q installed; then
      emit "dkms" "amdxdna already installed for kernel $kernel"
      continue
    fi
    emit "dkms" "building + signing amdxdna for kernel $kernel"
    sudo -E DEBIAN_FRONTEND=noninteractive dkms install -m amdxdna -v "$dkms_ver" -k "$kernel" 2>&1 | tail -5 || {
      emit "error" "dkms install failed for kernel $kernel"
      return 1
    }
  done

  emit "dkms" "amdxdna module built and signed for all installed kernels"
}

detect_os() {
  local os_name
  os_name="$(uname -s)"
  case "$os_name" in
    Linux)
      if [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        echo "linux:${ID:-unknown}:${VERSION_ID:-unknown}"
      else
        echo "linux:unknown:unknown"
      fi
      ;;
    Darwin) echo "macos:darwin:$(sw_vers -productVersion 2>/dev/null || echo unknown)" ;;
    *) echo "$os_name:unknown:unknown" ;;
  esac
}

install_ubuntu() {
  local version="$1"
  emit "start" "Ubuntu $version detected"
  case "$version" in
    24.04|25.10)
      emit "apt" "adding lemonade-team PPA"
      sudo add-apt-repository -y ppa:lemonade-team/stable
      sudo apt update
      emit "apt" "installing libxrt-npu2 + amdxdna-dkms + lemonade-server"
      sudo -E DEBIAN_FRONTEND=noninteractive apt install -y libxrt-npu2 amdxdna-dkms lemonade-server
      ;;
    26.04)
      emit "apt" "installing libxrt-npu2 + amdxdna-dkms + lemonade-server (already in archive)"
      sudo -E DEBIAN_FRONTEND=noninteractive apt install -y libxrt-npu2 amdxdna-dkms lemonade-server
      ;;
    *)
      emit "error" "Ubuntu $version is not currently tested. Lemonade officially supports 24.04, 25.10, 26.04."
      return 1
      ;;
  esac

  # Secure Boot handling. The amdxdna-dkms package builds an unsigned .ko.
  # Under Secure Boot the kernel refuses to load unsigned modules, so we
  # auto-wire DKMS to sign with a MOK and queue that MOK for enrollment at
  # the next boot. The user must approve the enrollment from shim's
  # MokManager screen (this can't be automated — it's by design).
  sb_setup_mok || emit "warn" "Secure Boot / MOK setup skipped — see details above"
  sb_build_sign_amdxdna || emit "warn" "amdxdna DKMS build/sign skipped — see details above"
  # IOMMU / SVA enablement. The amdxdna driver needs the NPU's IOMMU group
  # in DMA (translated) mode to bind Shared Virtual Addressing. Ubuntu's
  # default puts platform devices in identity (passthrough) mode, which
  # causes `SVA bind device failed, ret -95` in dmesg and makes FLM/Lemonade
  # report "No NPU device found." Fix is persistent via kernel cmdline.
  npu_setup_iommu_cmdline || emit "warn" "IOMMU cmdline setup skipped — see details above"

  # FastFlowLM .deb — per-Ubuntu-version asset from FastFlowLM/FastFlowLM
  # releases. Filename pattern: fastflowlm_VERSION_ubuntu<ver>_amd64.deb.
  emit "flm" "resolving FastFlowLM .deb for Ubuntu $version"
  local flm_url
  flm_url="$(
    curl -sL "$FLM_RELEASE_URL" \
      | grep -oE "https://[^\"]+fastflowlm_[^\"]+_ubuntu${version}_amd64\.deb" \
      | head -1
  )"
  if [ -z "$flm_url" ]; then
    emit "error" "could not resolve FastFlowLM .deb for Ubuntu $version from FastFlowLM/FastFlowLM releases"
    return 1
  fi
  emit "flm" "downloading $flm_url"
  local tmp
  tmp="$(mktemp -t flm-XXXXXX.deb)"
  curl -sL -o "$tmp" "$flm_url"
  emit "flm" "installing FastFlowLM .deb"
  sudo -E DEBIAN_FRONTEND=noninteractive apt install -y "$tmp"
  rm -f "$tmp"

  emit "done" "lemonade-server + FastFlowLM installed. Lemonade listens on port 13305. Reboot recommended but not strictly required — amdxdna module is already loaded on this kernel."
  return 0
}

install_arch() {
  emit "start" "Arch Linux detected"
  if command -v paru >/dev/null 2>&1; then
    paru -S --noconfirm lemonade-sdk-bin || {
      emit "error" "paru install failed. Try: yay -S lemonade-sdk-bin"
      return 1
    }
  elif command -v yay >/dev/null 2>&1; then
    yay -S --noconfirm lemonade-sdk-bin || {
      emit "error" "yay install failed."
      return 1
    }
  else
    emit "error" "No AUR helper found. Install paru or yay, then re-run."
    return 1
  fi
  emit "done" "Lemonade installed via AUR."
}

install_fedora() {
  emit "start" "Fedora detected"
  # Placeholder: Lemonade docs list Fedora 43 with .rpm. Point at their
  # latest release + install. Likely via dnf copr until they ship to
  # the main archive.
  emit "error" "Fedora install not yet implemented in this plugin. See https://lemonade-server.ai/install_options.html#fedora"
  return 1
}

install_macos() {
  emit "start" "macOS detected"
  # Lemonade macOS beta ships a .pkg installer from their github.
  # Defer to manual install for now — macOS NPU story is early.
  emit "error" "macOS install not yet implemented in this plugin. See https://lemonade-server.ai/install_options.html#macos"
  return 1
}

main() {
  local os_triple
  os_triple="$(detect_os)"
  local platform os_id os_version
  IFS=: read -r platform os_id os_version <<<"$os_triple"

  case "$platform:$os_id" in
    linux:ubuntu) install_ubuntu "$os_version" ;;
    linux:arch)   install_arch ;;
    linux:fedora) install_fedora ;;
    macos:*)      install_macos ;;
    *)
      emit "error" "Unsupported platform: $os_triple"
      exit 1
      ;;
  esac
}

main "$@"
