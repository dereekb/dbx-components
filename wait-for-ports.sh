#!/bin/bash

i=1
PORTS_TO_KILL=9900-9906
KILL=
KILL_AFTER=5

checkInUse () {
  IN_USE=$(lsof -t -i:$PORTS_TO_KILL -sTCP:LISTEN)
}

checkInUse

echo "Waiting for ports $PORTS_TO_KILL to be available."

while [[ ! -z "$IN_USE" ]]
do
  echo "Ports still in use. Waiting for ports to close... PIDs: $IN_USE";
  sleep 2;
  i=$(( $i + 1 ))
  checkInUse

  if [[ $i -gt $KILL_AFTER ]]
  then
    echo 'Preparing to forcefully kill ports...'
    kill -9 $(lsof -t -i:$PORTS_TO_KILL -sTCP:LISTEN)
    checkInUse
  fi
done

echo 'Ports are available.'
