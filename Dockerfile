FROM debian:bookworm-20240110

RUN apt update

RUN apt install --no-install-recommends -y \
  python3 \
  procps \
  curl vim-nox aptitude

RUN echo 'deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main' > /etc/apt/sources.list.d/nodesource.list

COPY apt-keys/nodesource.gpg /usr/share/keyrings/nodesource.gpg

RUN apt update

RUN apt install --no-install-recommends -y \
  nodejs

RUN apt install --no-install-recommends -y \
  git

RUN corepack enable

RUN git clone https://github.com/AmsterdamUniversityPress/fb-site.git /fb-site
RUN cd /fb-site && yarn

# ARG CACHEBUST
# RUN echo "$CACHEBUST"

RUN cd /fb-site && git pull && git reset --hard f1bdf8a
RUN cd /fb-site && yarn

COPY build/latest-data/fb-tst.json /fb-site/__data/fb-data-tst.json
COPY build/latest-data/fb-acc.json /fb-site/__data/fb-data-acc.json
COPY build/latest-data/fb-prd.json /fb-site/__data/fb-data-prd.json

RUN cd /fb-site && FB_ENV=tst npx @11ty/eleventy

COPY functions.bash /
COPY start.sh /start.sh

CMD ["/start.sh"]
