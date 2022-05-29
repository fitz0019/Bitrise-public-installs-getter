require('dotenv').config()
const axios = require('axios')
const moment = require('moment')
const targetedApps = require('./apps.json')

const statusMapper = {
  1: 'success',
  2: 'failed',
  3: 'aborted'
}

const fs = require('fs')
const workflowFilter = process.env.WORKFLOW
const statusFilter = typeof process.env.STATUS === 'number' ? statusMapper[process.env.STATUS] : process.env.STATUS


const bitriseBase = 'https://api.bitrise.io/v0.1'

const getBuildsUrl = ({ app_slug }) => `${bitriseBase}/apps/${app_slug}/builds`
const getBuildArtifactsUrl = ({ app_slug, build_slug }) => `${bitriseBase}/apps/${app_slug}/builds/${build_slug}/artifacts`
const getBuildArtifactInfoUrl = ({ app_slug, build_slug, artifact_slug }) => `${bitriseBase}/apps/${app_slug}/builds/${build_slug}/artifacts/${artifact_slug}`

axios.defaults.headers.common['Authorization'] = process.env.BITRISE_TOKEN
async function init() {
  const date = moment().format('YYYYMMDD')
  if (!fs.existsSync(`./data`)) {
    fs.mkdirSync(`./data`)
  }
  if (!fs.existsSync(`./data/${date}`)) {
    fs.mkdirSync(`./data/${date}`)
  }
  let publicInstallPages = {}
  console.log(`Getting information for: ${targetedApps.length} apps`)
  for (const app of targetedApps) {
    const { app_slug, name } = app
    console.log(`Getting information for: ${name}`)
    const { data: { data: appData } } = await axios.get(getBuildsUrl({ app_slug })).catch(ex => console.log(ex))
    console.log(`Filtering by [workflowFilter: ${!!workflowFilter}, statusFilter: ${!!statusFilter}]`)
    const filteredAppData = appData.filter(({ triggered_workflow, status_text }) => {
      const matchesWorkFlowFilter = workflowFilter === undefined || triggered_workflow === workflowFilter
      const matchesStatusFilter = statusFilter === undefined || status_text === statusFilter
      return matchesWorkFlowFilter && matchesStatusFilter
    })
    const latestBuild = filteredAppData.sort((a, b) => moment(b.triggered_at).isSameOrAfter(b.triggered_at))[0]
    console.log(`Latest build_slug matching filter parameters: ${latestBuild?.slug || 'NO BUILD FOUND'}`)
    const build_slug = latestBuild?.slug
    console.log(`Getting artifacts for build`)
    const { data: { data: artifactData } } = await axios.get(getBuildArtifactsUrl({ app_slug, build_slug })).catch(ex => console.log(ex))
    const publicInstallArtifact = artifactData.filter(({ is_public_page_enabled }) => !!is_public_page_enabled)[0]
    const { slug: artifact_slug } = publicInstallArtifact
    console.log(`Getting artifact information`)
    const { data: { data: artifactInfo } } = await axios.get(getBuildArtifactInfoUrl({ app_slug, build_slug, artifact_slug })).catch(ex => console.log(ex))
    const { public_install_page_url } = artifactInfo
    publicInstallPages[name] = public_install_page_url
    // FOR DEBUGGING
    // fs.writeFileSync(`./data/${date}/${name}_artifacts.json`, JSON.stringify(artifactData, null, 2))
    // fs.writeFileSync(`./data/${date}/${name}_artifact_public.json`, JSON.stringify(publicInstallArtifact, null, 2))
    // fs.writeFileSync(`./data/${date}/${name}_artifact_info.json`, JSON.stringify(artifactInfo, null, 2))
  }
  fs.writeFileSync(`./data/${date}_public_install_pages.txt`, JSON.stringify(publicInstallPages, null, 2))
}


init()
