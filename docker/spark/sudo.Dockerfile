FROM chethanuk/polynote:0.3.12-spark3hd3-py38

USER root

ARG USER=${NB_USER}

RUN apt install -y sudo &&\
    # Add SUDO Users
    echo "$USER ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/$USER && \
    chmod 0440 /etc/sudoers.d/$USER && \
    ln -s /lib /lib64

USER ${NB_USER}