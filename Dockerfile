FROM node:lts-alpine

RUN apk -v --update add \
    bash \  
    python \
    make \
    gcc \
    g++

RUN mkdir -p /opt/fabric
RUN chown -R node:node /opt/fabric

# Preinstall required node packages
USER node
ENV NPM_CONFIG_PREFIX=/opt/fabric
RUN npm install -g \
        body-parser@1.19.0 \
        chalk@2.4.2 \
        express@4.16.4 \
        express-gateway@1.16.3 \
        express-openapi@4.6.4 \
        express-winston@3.1.0 \
        fabric-ca-client@1.4.1 \
        fabric-client@1.4.3 \
        fabric-network@1.4.1 \
        fabric-shim@1.4.1 \
        js-yaml@3.13.1 \
        lodash@4.17.11 \
        openapi-request-validator@3.8.3 \
        openapi-response-validator@3.8.2 \
        swagger-parser@8.0.0 \
        swagger-ui-express@4.0.7 \
        uuid@3.3.2 \
        winston@3.2.1

ENV NODE_PATH=/opt/fabric/lib/node_modules

ARG gwFilename

COPY artifacts/${gwFilename} /opt/fabric
WORKDIR /opt/fabric
RUN tar xzf /opt/fabric/${gwFilename}
WORKDIR /opt/fabric/gw

RUN npm install --production
EXPOSE 8888
USER root
ENTRYPOINT [ "npm", "run", "start" ]