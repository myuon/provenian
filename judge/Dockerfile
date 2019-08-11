FROM makarius/isabelle:Isabelle2019

USER root

# Install node
RUN apt-get update && apt-get install -y nodejs npm && apt-get clean
RUN npm install n -g 
RUN n 10

ADD ./ /src
RUN mkdir /src/isabelle
WORKDIR /src

# Run judge
RUN cd src && npm ci
ENV ISABELLE_PATH=/home/isabelle/Isabelle/bin/isabelle
ENV SUBMISSION_FILE_PATH=/src/isabelle/Submitted.thy
ENTRYPOINT [ "npx", "ts-node", "src/judge.ts" ]
