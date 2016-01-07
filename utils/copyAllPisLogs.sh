#!/bin/bash
# $1 ... sourcedir
# $2 ... targetdir
# $3 ... picount

for i in $(seq 0 $(expr $3 - 1))
do
   sh copyPiLog.sh $i $1 $2 &
done

wait $(jobs -p)

