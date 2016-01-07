#!/bin/bash
# $1 ... pi-id as cmd param
# $2 ... sourcedir
# $3 ... targetdir
TARGET="$3PI$1.json"
cd $2
for FILE in $(ls | grep "^stat-PI_$1\_+*")
do
    cp $FILE $TARGET
    sleep 5
done
