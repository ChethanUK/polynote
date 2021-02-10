#!/bin/sh

set -e -x

rsync_to_gcs () {
  SOURCE_DIR="$1"
  SOURCE_HOME="$2"
  GCS_DEST_DIR="$3"  
  rclone sync ${EXTRA_ARGS} ${SOURCE_HOME}/${SOURCE_DIR} :gcs:${BUCKET}/${GCS_DEST_DIR}
}

rsync_from_gcs () {
  GCS_DIR="$1"
  DEST_HOME="$2"
  DEST_DIR="$3"
  rclone sync ${EXTRA_ARGS} :gcs:${BUCKET}/${GCS_DIR} ${DEST_HOME}/${DEST_DIR}
}

sync_gcs () {
  INIT=$1

  if [ -z $INIT ]; then
    INIT=false    
  fi     

  if [ "$INIT" = true ] ; then
      echo 'Running pod init script, Copy SYNC_DIRS: ${SYNC_DIRS} from GCS to POD'
      for DIR in ${SYNC_DIRS}
      do
        echo "Staring rlcone from k8s dir ${SOURCE_DIR} to GCS ${BUCKET}/${DIR}"
        rsync_from_gcs ${DIR} ${DESTINATION_HOME} ${DIR}
      done      
  fi
  
  start=`date +%s`
  echo "RCLONE SYNC from GCS to POD and CODE_DIRS: ${CODE_DIRS}"
  for DIR in ${CODE_DIRS}
  do
    echo "Staring rlcone from k8s GCS dir ${BUCKET}/${DIR} to GCS ${BUCKET}/${DIR}"
    rsync_from_gcs ${DIR} ${DESTINATION_HOME} ${DIR}
  done

  echo "RCLONE SYNC from GCS to POD and CODE_DIRS: ${CODE_DIRS}"
  for DIR in ${SYNC_DIRS}
  do
    SOURCE_DIR="${DESTINATION_HOME}/${DIR}"
    echo "Staring rlcone from k8s dir ${SOURCE_DIR} to GCS ${BUCKET}/${DIR}"
    rsync_to_gcs ${DIR} ${DESTINATION_HOME} ${DIR}
  done
  
  exitCode=$?
  if [ $exitCode -ne 0 ]; then
  echo "Rclone execution failed with exit code "$exitCode
  else
  end=`date +%s`
  echo "Synchronization completed in "$((end-start))" seconds"
  fi
}

graceful_exit() {
    # include this line: trap graceful_exit TERM INT HUP
    echo "Gracefully Exit requested..."
    local timeout=${1:-4}
    local list=""
    # ps -o user,group,comm,args,pid,ppid,pgid,etime,nice,rgroup,ruser,time,tty,vsz,sid,stat,rss
    for c in $(ps -o ppid $$); do
        # request children shutdown
        echo "Kill ${c}"
        # kill -0 ${c} 2>/dev/null && kill -TERM ${c} && list="$list $c" || true
    done
    if [ -n "$list" ]; then
        # schedule hard kill after timeout
        (sleep ${timeout}; kill -9 ${list} 2>/dev/null || true) &
        local killer=${!}
        wait ${list} 2>/dev/null || true
        # children exited gracfully - cancel timer
        sleep 0.5 && kill -9 ${killer} 2>/dev/null && list="" || true
    fi

    [ -z "$list" ] && echo "Exit Gracefully (0)" && exit 0 || echo "Dirty Exit (1)" && exit 1
}

echo "Start rclone script"
sync_gcs true
echo "sync_gcs_pod is done"
# this line exectues when process exits
trap 'graceful_exit 5' TERM INT HUP

while true; do
    sync_gcs
    sleep $SLEEP
    trap 'graceful_exit 5' TERM INT HUP
done
echo "Something terrible happened, the rsync script is broken with error code "$?
# Let's exit with -1 to let k8s to restart the pod.
# termination action?
echo "Terminating, Sleep 10"
sleep 10
echo "Terminating"
exit -1