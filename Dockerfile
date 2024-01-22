FROM debian:bookworm-20240110

RUN apt update

RUN apt install --no-install-recommends -y \
  python3 \
  procps \
  curl vim-nox aptitude

COPY functions.bash /
COPY start.sh /start.sh
COPY index-tst.html /
COPY index-acc.html /
COPY index-prd.html /

CMD ["/start.sh"]
