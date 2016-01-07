#!/bin/bash
# $1 ... sourcedir
# $2 ... targetdir
# $3 ... picount
# 20 PIs, from id = 0 to id = 19
# just try to copy all of them, never mind if one is not present

for i in $(seq 0 $(expr $3 - 1))
do
   sh copyPiRtLog.sh "$1consumer-PI_$i.log" $i $2 &
done

wait $(jobs -p)

