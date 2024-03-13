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

# --- keep for now, though not currently useful
# ARG CACHEBUST
# RUN echo "$CACHEBUST"

RUN cd /fb-site && git pull && git submodule update --init --recursive && git reset --hard 0f713bb
RUN cd /fb-site && yarn

COPY fb-site-config/config.mjs /fb-site/backend/src/config.mjs

RUN cd /fb-site && bin/build-backend

COPY build/latest-data/fb-tst.json /fb-site/__data/fb-data-tst.json
COPY build/latest-data/fb-acc.json /fb-site/__data/fb-data-acc.json
COPY build/latest-data/fb-prd.json /fb-site/__data/fb-data-prd.json

RUN cd /fb-site/frontend && APP_ENV=tst npx alleycat-frontend --app-dir=app --config-file=config.mjs build-tst --build-dir=build-tst
RUN cd /fb-site/frontend && APP_ENV=acc npx alleycat-frontend --app-dir=app --config-file=config.mjs build-acc --build-dir=build-acc
RUN cd /fb-site/frontend && APP_ENV=prd npx alleycat-frontend --app-dir=app --config-file=config.mjs build-prd --build-dir=build-prd

COPY functions.bash /
COPY start.sh /start.sh

CMD ["/start.sh"]
