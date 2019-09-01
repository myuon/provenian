FROM makarius/isabelle:Isabelle2019

USER root

# Install golang
RUN apt-get update && apt-get install -y software-properties-common git
RUN add-apt-repository ppa:longsleep/golang-backports
RUN apt-get install -y golang-go

ADD ./ /src
WORKDIR /src

# Run judge
RUN go build src/main.go
ENV ISABELLE_PATH=/home/isabelle/Isabelle/bin/isabelle
ENV SUBMISSION_FILE_PATH=/src/isabelle/Submitted.thy
ENTRYPOINT [ "./main" ]
