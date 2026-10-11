#!/bin/bash
# Rebuild web/sounds from public-domain (CC0) Freesound recordings.
# Needs curl, ffmpeg 5 or later with libmp3lame, and network access; normal
# builds never run it. Rerun after changing a row in the table below.
set -euo pipefail

sounds_dir=$(cd "$(dirname "$0")" && pwd)/web/sounds
sounds_cache=${TMPDIR:-/tmp}/little-reef-sounds
mkdir -p "$sounds_dir" "$sounds_cache"

# Sound, Freesound id, excerpt start and length (s), target loudness (LUFS,
# that of the synthesized track it replaces), the most limiting allowed to
# reach it (dB), and the high-quality preview. "#" rows are alternatives.
# clock, knock and musicbox loop on beats or where the tune ends, as set in
# web/audio.js; a new recording for them needs those values measured again.
sounds_table='
waves    412308 148    90    -15.6 3 https://cdn.freesound.org/previews/412/412308_7707368-hq.ogg
#        241824 https://cdn.freesound.org/previews/241/241824_4404567-hq.ogg waves_1.wav
#        463250 https://cdn.freesound.org/previews/463/463250_7482766-hq.ogg Beach Waves 04.wav
rain     56311  44     60    -15.7 3 https://cdn.freesound.org/previews/56/56311_91374-hq.ogg
#        217236 https://cdn.freesound.org/previews/217/217236_4054839-hq.ogg steady rain in the city.wav
#        188655 https://cdn.freesound.org/previews/188/188655_1178799-hq.ogg 1 Minute Rain (Medium)
thunder  447510 755    90    -16.5 3 https://cdn.freesound.org/previews/447/447510_1661766-hq.ogg
#        158692 https://cdn.freesound.org/previews/158/158692_179538-hq.ogg Distant Thunder and Rain from Half Open Window 1.aif
#        577846 https://cdn.freesound.org/previews/577/577846_10548058-hq.ogg Rain and distant thunder 1
stream   446019 1      60    -15.2 6 https://cdn.freesound.org/previews/446/446019_7241289-hq.ogg
#        236981 https://cdn.freesound.org/previews/236/236981_2258946-hq.ogg Stream Running Into Pond
#        415053 https://cdn.freesound.org/previews/415/415053_7707368-hq.ogg Brook 2.wav (mono)
bubbles  635477 26     60    -24.8 3 https://cdn.freesound.org/previews/635/635477_612689-hq.ogg
#        870769 https://cdn.freesound.org/previews/870/870769_18412227-hq.ogg Aquarium Pump and Bubbles (mono)
#        329622 https://cdn.freesound.org/previews/329/329622_5735740-hq.ogg Aquarium 1.wav (mono)
boil     635619 0      60    -16.0 3 https://cdn.freesound.org/previews/635/635619_612689-hq.ogg
#        420228 https://cdn.freesound.org/previews/420/420228_8375530-hq.ogg 37 - 17 Boiling water.wav
#        380828 https://cdn.freesound.org/previews/380/380828_5763832-hq.ogg Pot of Water Boiling
deepsea  393819 26     60    -17.3 3 https://cdn.freesound.org/previews/393/393819_2247456-hq.ogg
#        366159 https://cdn.freesound.org/previews/366/366159_6725579-hq.ogg Underwater [Loop] AMB.wav
#        482167 https://cdn.freesound.org/previews/482/482167_4838691-hq.ogg Underwater Ambience.wav
wind     139337 82     60    -17.1 3 https://cdn.freesound.org/previews/139/139337_1661766-hq.ogg
#        165526 https://cdn.freesound.org/previews/165/165526_1661766-hq.ogg Wind singing in the mountain
#        181801 https://cdn.freesound.org/previews/181/181801_3153523-hq.ogg breeze.wav
fire     248303 61     60    -19.0 6 https://cdn.freesound.org/previews/248/248303_1001802-hq.ogg
#        145774 https://cdn.freesound.org/previews/145/145774_43834-hq.ogg crackling_fire_021012.wav
#        501417 https://cdn.freesound.org/previews/501/501417_10869493-hq.ogg Aachen Burning Fireplace
forest   150174 13     90    -19.1 3 https://cdn.freesound.org/previews/150/150174_229898-hq.ogg
#        385280 https://cdn.freesound.org/previews/385/385280_2341984-hq.ogg sfx_amb_forest_spring_afternoon-01.wav
#        460178 https://cdn.freesound.org/previews/460/460178_4817223-hq.ogg forest ambience, steady breeze
summer   79086  44     60    -21.0 3 https://cdn.freesound.org/previews/79/79086_384438-hq.ogg
#        272169 https://cdn.freesound.org/previews/272/272169_3186672-hq.ogg Cicadas
#        458113 https://cdn.freesound.org/previews/458/458113_300738-hq.ogg Countryside
night    532301 62     90    -25.9 3 https://cdn.freesound.org/previews/532/532301_2669618-hq.ogg
#        333221 https://cdn.freesound.org/previews/333/333221_2098408-hq.ogg Night Crickets Back Porch.aiff
#        328293 https://cdn.freesound.org/previews/328/328293_1661766-hq.ogg Forest at night in Sian Kaan
desert   156414 24     60    -17.7 3 https://cdn.freesound.org/previews/156/156414_1661766-hq.ogg
#        146436 https://cdn.freesound.org/previews/146/146436_1661766-hq.ogg Dry grass rustling in the wind, desert of Chile
#        457159 https://cdn.freesound.org/previews/457/457159_806506-hq.ogg Desert binaural Wind.WAV
morning  573080 388    90    -22.7 3 https://cdn.freesound.org/previews/573/573080_1149179-hq.ogg
#        270370 https://cdn.freesound.org/previews/270/270370_1992775-hq.ogg Various Birds singing in the Morning
#        165516 https://cdn.freesound.org/previews/165/165516_2022935-hq.ogg Dawn Chorus.mp3
clock    170445 0.059  31.5  -28.7 3 https://cdn.freesound.org/previews/170/170445_1661766-hq.ogg
#        434841 https://cdn.freesound.org/previews/434/434841_1738686-hq.ogg Kitchen Wall Clock Ticking 2
#        171043 https://cdn.freesound.org/previews/171/171043_2449563-hq.ogg Mechanical alarm clock is ticking (5 ticks/s)
knock    607215 0      31.3  -30.3 3 https://cdn.freesound.org/previews/607/607215_541139-hq.ogg
#        863784 https://cdn.freesound.org/previews/863/863784_17110092-hq.ogg Temple Blocks (5pcs), one strike per block
cafe     404478 5      55    -18.7 3 https://cdn.freesound.org/previews/404/404478_5200244-hq.ogg
#        370973 https://cdn.freesound.org/previews/370/370973_5835751-hq.ogg coffee shop ambience (mono)
#        125247 https://cdn.freesound.org/previews/125/125247_1812576-hq.ogg CoffeeShopChatter.wav
musicbox 158206 0      33.8  -22.4 3 https://cdn.freesound.org/previews/158/158206_94105-hq.ogg
#        210799 https://cdn.freesound.org/previews/210/210799_770707-hq.ogg gentle music box (check the tune is public domain)
#        381973 https://cdn.freesound.org/previews/381/381973_926978-hq.ogg Music box lullaby (check the tune is public domain)
traffic  330427 68     90    -15.6 3 https://cdn.freesound.org/previews/330/330427_3287894-hq.ogg
#        135097 https://cdn.freesound.org/previews/135/135097_658546-hq.ogg Room Tone Office Quiet Distant Traffic.wav
#        208502 https://cdn.freesound.org/previews/208/208502_1756543-hq.ogg highway, atmo, distant.wav
'

# Prints integrated loudness (LUFS) and true peak (dBTP) of the given input.
measure() {
  ffmpeg -nostdin -hide_banner -nostats "$@" -af ebur128=peak=true -f null - 2>&1 |
    awk '/Integrated loudness:/ { s = 1 } s && $1 == "I:" { i = $2 } /True peak:/ { t = 1 } t && $1 == "Peak:" { print i, $2; exit }'
}

# Lays out 22 mokugyo strikes 1.35 s apart, then the first strike again one
# period later so the loop seam repeats exactly. Timing (±25 ms) and force
# (±15 %) vary with a fixed seed.
compose_knock() {
  local graph
  graph=$(awk 'BEGIN {
    seed = 1229; n = 22; period = 1.35
    for (i = 0; i < n; i++) {
      seed = seed * 16807 % 2147483647; at[i] = .6 + i * period + (seed / 2147483647 - .5) * .05
      seed = seed * 16807 % 2147483647; force[i] = 1 + (seed / 2147483647 - .5) * .3
    }
    at[n] = at[0] + n * period; force[n] = force[0]
    printf "[0:a]atrim=0:1.2,afade=t=out:st=0.8:d=0.4,asplit=%d", n + 1
    for (i = 0; i <= n; i++) printf "[s%d]", i
    printf ";"
    for (i = 0; i <= n; i++) printf "[s%d]volume=%.3f,adelay=%d:all=1[h%d];", i, force[i], at[i] * 1000 + .5, i
    for (i = 0; i <= n; i++) printf "[h%d]", i
    printf "amix=inputs=%d:normalize=0,atrim=0:%.2f", n + 1, n * period + 1.6
  }')
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$1" -filter_complex "$graph" -c:a pcm_s24le "$2"
}

# Levels one excerpt toward its target, allowing at most $6 dB of limiting
# above -2.5 dBFS (at 4x oversampling, so intersample peaks count too),
# encodes it, and checks the MP3 itself.
build() {
  local id=$1 source=$2 start=$3 length=$4 target=$5 cap=$6 out=$sounds_dir/$1.mp3
  local rate loud peak gain
  rate=$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 "$source")
  rate=$(( rate > 48000 ? 48000 : rate ))
  read -r loud peak < <(measure -ss "$start" -t "$length" -i "$source")
  gain=$(awk -v t="$target" -v i="$loud" -v p="$peak" -v c="$cap" 'BEGIN {
    g = t - i; over = p + g + 2.5; if (over > c) g -= over - c; printf "%.2f", g }')
  ffmpeg -nostdin -hide_banner -loglevel error -y -ss "$start" -t "$length" -i "$source" -map_metadata -1 \
    -af "aresample=$((rate * 4)),volume=${gain}dB,alimiter=limit=0.75:level=false:latency=true,aresample=$rate" \
    -c:a libmp3lame -q:a 2 -id3v2_version 0 "$out"
  read -r loud peak < <(measure -i "$out")
  printf '%-9s %5s s  %6s LUFS (目标 %s)  峰值 %5s dBTP  增益 %6s dB\n' "$id" "$length" "$loud" "$target" "$peak" "$gain"
  if ! awk -v p="$peak" 'BEGIN { exit !(p <= -1) }'; then
    printf '%s 的峰值超过 -1 dBTP。\n' "$id" >&2
    exit 1
  fi
}

while read -r id sid start length target cap url; do
  [[ -z $id || $id == \#* ]] && continue
  source=$sounds_cache/$sid.ogg
  if [[ ! -s $source ]]; then
    curl -fsSL --retry 3 -C - -o "$source.part" "$url"
    mv "$source.part" "$source"
  fi
  if [[ $id == knock ]]; then
    compose_knock "$source" "$sounds_cache/knock.wav"
    source=$sounds_cache/knock.wav
  fi
  build "$id" "$source" "$start" "$length" "$target" "$cap"
done <<<"$sounds_table"

total=$(cat "$sounds_dir"/*.mp3 | wc -c)
printf '共 %s 个文件，%s MB。\n' "$(ls "$sounds_dir"/*.mp3 | wc -l | tr -d ' ')" "$(awk -v b="$total" 'BEGIN { printf "%.1f", b / 1048576 }')"
if (( total > 30 * 1048576 )); then
  printf '超出 30 MB 预算：缩短事件型片段，或改用 -q:a 3。\n' >&2
  exit 1
fi
