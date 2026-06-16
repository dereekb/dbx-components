#!/bin/bash
echo "Deleting all emulator data in 3 seconds...";
sleep 3;
rm -r ./.firebase/data/emulators
echo "Deleted emulator data.";
