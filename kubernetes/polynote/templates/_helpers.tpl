{{/*
Expand the name of the chart.
*/}}
{{- define "polynote.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "polynote.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "polynote.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "polynote.labels" -}}
helm.sh/chart: {{ include "polynote.chart" . }}
{{ include "polynote.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "polynote.selectorLabels" -}}
app.kubernetes.io/name: {{ include "polynote.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "polynote.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "polynote.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/* User defined environment variables */}}
{{- define "custom_environment_variables" }}
  # Dynamically created environment variables
  {{- range $i, $config := .Values.env }}
  - name: {{ $config.name }}
    value: {{ $config.value | quote }}
  {{- end }}
{{- end }}

{{/* RClone volumeMounts */}}
{{- define "sidecars.sync.volumeMounts" }}
- name: notebooks-folder
  mountPath: {{ .Values.sync.notebooks.path }}
  mountPropagation: Bidirectional
- name: data-folder
  mountPath: {{ .Values.sync.data.path }}
  mountPropagation: Bidirectional
{{- end -}}

{{/* RClone volumes */}}
{{- define "sidecar.sync.volumes" }}
- name: notebooks-folder # mountPath
  emptyDir:
    sizeLimit: {{ .Values.sync.rclone.maxSizeLimit }}
- name: data-folder # mountPath
  emptyDir:
    sizeLimit: {{ .Values.sync.rclone.maxSizeLimit }}
{{- end -}}

{{/* RClone sidecar container */}}
{{- define "sidecars.sync.container" }}
- name: gcs-sync
  image: "{{ .Values.sync.rclone.image.repo }}:{{ .Values.sync.rclone.image.tag }}"
  imagePullPolicy: {{ .Values.sync.rclone.image.pullPolicy }}
  resources:
    limits:
      cpu: {{ .Values.sync.rclone.limits.cpu }}
      memory: {{ .Values.sync.rclone.limits.memory }}
    requests:
      cpu: {{ .Values.sync.rclone.requests.cpu }}
      memory: {{ .Values.sync.rclone.requests.memory }}
  env:
    - name: BUCKET
      value: {{ .Values.sync.rclone.gcs.bucket }}
    - name: SYNC_DIRS
      value: "{{ .Values.sync.rclone.syncDirs }}"
    - name: DESTINATION_HOME
      value: {{ .Values.polynoteHome }}
    - name: RCLONE_GCS_SERVICE_ACCOUNT_FILE
      value: {{ .Values.sync.rclone.gcs.mountPath }}
    - name: SLEEP
      value: "{{ .Values.sync.rclone.sleep }}"
    - name: EXTRA_ARGS
      value: "{{ .Values.sync.rclone.extraArgs }}"
  securityContext:
    runAsUser: 0
    runAsGroup: 0
    privileged: true
  volumeMounts:
    - name: notebooks-folder
      mountPath: {{ .Values.sync.notebooks.path }}
      mountPropagation: Bidirectional
    - name: data-folder
      mountPath: {{ .Values.sync.data.path }}
      mountPropagation: Bidirectional
    - mountPath: {{ .Values.sync.rclone.gcs.mountPath }}
      name: gcp-gcs-sa-volume
      subPath: {{ .Values.sync.rclone.gcs.saFilename }}
{{- end }}