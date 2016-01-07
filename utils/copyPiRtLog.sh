#!/bin/bash
# $1 ... source-filename
# S2 ... id
# $3 ... targetdir

TARGET="$3consumer-PI_$2.log"

rm $TARGET
while read line   # read from stdin (needs file redirected into stdin)
do
   echo "$line" >> $TARGET
   sleep 1
done < $1
