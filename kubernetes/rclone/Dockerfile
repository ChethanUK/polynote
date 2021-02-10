FROM rclone/rclone:1.54
COPY entrypoint.sh /
ENV SLEEP=60
ENV EXTRA_ARGS="-vvv --cache-chunk-no-memory"
ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]


