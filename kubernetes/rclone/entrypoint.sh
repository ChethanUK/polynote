#!/bin/sh

set -e -x

sync_gcs_pod () {
  RCLONE_DIRS="$1"
  start=`date +%s`
  echo "RCLONE SYNC from GCS to POD and RCLONE_DIRS: ${RCLONE_DIRS}"
  for DIR in ${RCLONE_DIRS}
  do
    echo "Syncing ${DIR}"

    if [ -z "$(ls -A $DIR)" ]; then
      echo "Directory $DIR is Empty so sync"
      rclone sync ${EXTRA_ARGS} :gcs:${BUCKET}/${DIR} ${DESTINATION_HOME}/${DIR}
    else
      echo "Directory $DIR Not Empty"
    fi

  done
  exitCode=$?
  if [ $exitCode -ne 0 ]; then
  echo "Rclone execution failed with exit code "$exitCode
  else
  end=`date +%s`
  echo "Synchronization completed in "$((end-start))" seconds"
  fi
}

sync_pod_gcs () {
  RCLONE_DIRS="$1"
  start=`date +%s`
  echo "RCLONE SYNC from POD to GCS and RCLONE_DIRS: ${RCLONE_DIRS}"
  for DIR in ${RCLONE_DIRS}
  do
    echo "Staring rlcone from k8s pod dir ${DESTINATION_HOME}/${DIR} to GCS ${BUCKET}/${DIR}"
    rclone sync ${EXTRA_ARGS} ${DESTINATION_HOME}/${DIR} :gcs:${BUCKET}/${DIR}
  done
  exitCode=$?
  if [ $exitCode -ne 0 ]; then
  echo "Rclone execution failed with exit code "$exitCode
  else
  end=`date +%s`
  echo "Synchronization completed in "$((end-start))" seconds"
  fi
}

echo "Start rclone script"
sync_gcs_pod ${SYNC_DIRS}
echo "sync_gcs_pod is done"

while true; do
    sync_pod_gcs ${SYNC_DIRS}
    sync_gcs_pod ${CODE_DIRS}
    sleep $SLEEP
done
echo "Something terrible happened, the rsync script is broken with error code "$?
# Let's exit with -1 to let k8s to restart the pod.
exit -1