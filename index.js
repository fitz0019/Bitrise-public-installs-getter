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
  let artifacts = []
  console.log(`Getting information for: ${targetedApps.length} apps`)
  for (const app of targetedApps) {
    const { app_slug, name } = app
    console.log(`Getting information for: ${name}`)
    const { data: { data: appData } = {} } = await axios.get(getBuildsUrl({ app_slug })).catch(ex => console.log(ex))
    console.log(`Filtering by [workflowFilter: ${!!workflowFilter}, statusFilter: ${!!statusFilter}]`)
    const filteredAppData = appData.filter(({ triggered_workflow, status_text }) => {
      const matchesWorkFlowFilter = workflowFilter === undefined || triggered_workflow === workflowFilter
      const matchesStatusFilter = statusFilter === undefined || status_text === statusFilter
      return matchesWorkFlowFilter && matchesStatusFilter
    })
    const latestBuild = filteredAppData.sort((a, b) => moment(b.triggered_at).isSameOrAfter(b.triggered_at))[0]
    console.log(`Latest build_slug matching filter parameters: ${latestBuild?.slug || 'NO BUILD FOUND'}`)
    const { slug: build_slug, finished_at: build_finished_at } = latestBuild
    console.log(`Getting artifacts for build`)
    const { data: { data: artifactData } = {} } = await axios.get(getBuildArtifactsUrl({ app_slug, build_slug })).catch(ex => console.log(ex))
    const publicInstallArtifact = artifactData.filter(({ is_public_page_enabled }) => !!is_public_page_enabled)[0]
    const { slug: artifact_slug } = publicInstallArtifact
    console.log(`Getting artifact information`)
    const { data: { data: artifactInfo } = {} } = await axios.get(getBuildArtifactInfoUrl({ app_slug, build_slug, artifact_slug })).catch(ex => console.log(ex))
    const { public_install_page_url } = artifactInfo
    publicInstallPages[name] = public_install_page_url
    artifacts.push({
      app_name: name,
      public_install_page_url,
      build_finished_at: moment(build_finished_at).format('DD/MM/YYYY HH:mm:ss')
    })
    // console.log(artifactInfo[name])
    // FOR DEBUGGING
    // fs.writeFileSync(`./data/${date}/${name}_artifacts.json`, JSON.stringify(artifactData, null, 2))
    // fs.writeFileSync(`./data/${date}/${name}_artifact_public.json`, JSON.stringify(publicInstallArtifact, null, 2))
    // fs.writeFileSync(`./data/${date}/${name}_latest_build.json`, JSON.stringify(latestBuild, null, 2))
  }
  console.log(`Writing out public install pages and artifact information`)
  let artifactDates = {}
  artifacts.forEach(({ build_finished_at, app_name }) => {
    const day = moment(build_finished_at, 'DD/MM/YYYY HH:mm:ss').format('YYYY/MM/DD')
    if (artifactDates[day] === undefined) artifactDates[day] = []
    artifactDates[day] = [...artifactDates[day], app_name]
  })
  if(Object.keys(artifactDates).length > 1){
    publicInstallPages.warning = `There is a mismatch of dates apps were built, please check ${date}_app_information.json for more information`
  }
  fs.writeFileSync(`./data/${date}_public_install_pages.json`, JSON.stringify(publicInstallPages, null, 2))
  fs.writeFileSync(`./data/${date}_app_information.json`, JSON.stringify({ artifacts, artifactDates }, null, 2))
}


init()
