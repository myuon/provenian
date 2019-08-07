FROM makarius/isabelle:Isabelle2019

USER root

# Install node
RUN apt-get update && apt-get install -y nodejs npm && apt-get clean
RUN npm install n -g 
RUN n 10

ADD ./ /src
WORKDIR /src

# Run judge
RUN npm ci
ENV ISABELLE_PATH=/home/isabelle/Isabelle/bin/isabelle
ENTRYPOINT [ "npx", "ts-node", "judge.ts" ]
