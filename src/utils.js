const axios = require('axios')
axios.defaults.headers.common['Authorization'] = process.env.BITRISE_TOKEN

const statusMapper = {
  1: 'success',
  2: 'failed',
  3: 'aborted'
}

const bitriseBase = 'https://api.bitrise.io/v0.1'
const getBuildsUrl = ({ app_slug }) => `${bitriseBase}/apps/${app_slug}/builds`
const getBuildArtifactsUrl = ({ app_slug, build_slug }) => `${getBuildsUrl({ app_slug })}/${build_slug}/artifacts`
const getBuildArtifactInfoUrl = ({ app_slug, build_slug, artifact_slug }) => `${getBuildArtifactsUrl({ app_slug, build_slug })}/${artifact_slug}`

const getBuilds = ({ app_slug }) => axios.get(getBuildsUrl({ app_slug })).then(({ data }) => data)
const getBuildArtifacts = ({ app_slug, build_slug }) => axios.get(getBuildArtifactsUrl({ app_slug, build_slug })).then(({ data }) => data)
const getBuildArtifactInfo = ({ app_slug, build_slug, artifact_slug }) => axios.get(getBuildArtifactInfoUrl({ app_slug, build_slug, artifact_slug })).then(({ data }) => data)

module.exports = {
  statusMapper,
  getBuilds,
  getBuildArtifacts,
  getBuildArtifactInfo
}
