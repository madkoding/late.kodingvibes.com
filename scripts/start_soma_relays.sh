#!/bin/bash
# Start 7 ffmpeg relays: SomaFM -> icecast. Idempotent.
set -u
pkill -9 -f 'ffmpeg.*somafm' 2>/dev/null
sleep 1
# Mount names now match the real SomaFM channel ids they relay.
# SomaFM does not provide a drum & bass channel, so "dnb" is not included.
for kv in \
  "groovesalad groovesalad" \
  "dronezone dronezone" \
  "fluid fluid" \
  "indiepop indiepop" \
  "u80s u80s" \
  "vaporwaves vaporwaves" \
  "metal metal" \
  "dubstep dubstep" \
  "7soul 7soul" \
  "beatblender beatblender" \
  "bootliquor bootliquor" \
  "doomed doomed" \
  "illstreet illstreet" \
  "lush lush" \
  "poptron poptron" \
  "secretagent secretagent" \
  "suburbsofgoa suburbsofgoa" \
  "thetrip thetrip" ; do
  mount=$(echo $kv | cut -d' ' -f1)
  ch=$(echo $kv | cut -d' ' -f2)
  setsid bash "$(dirname "$0")/soma_relay_one.sh" "$mount" "$ch" </dev/null >/dev/null 2>&1 &
done
sleep 2
echo "started $(pgrep -fc 'ffmpeg.*somafm') relays"
