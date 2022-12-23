require('dotenv').config()
const moment = require('moment')
const log = require('log-beautify')
const apps = require('../apps.json')
const fs = require('fs')
const json2md = require('json2md')

const {
  statusMapper,
  getBuilds,
  getBuildArtifacts,
  getBuildArtifactInfo
} = require('./utils')

async function getArtifactsForWorkflow({ workflow }) {
  let data = []
  let successes = []
  let fails = []
  for (const app of apps) {
    const { app_slug, name } = app
    try {
      log.info(`[${workflow}]\tStarting to get latest artifact for ${app.name}`)
      const { data: builds } = await getBuilds({ app_slug })
      if (!builds) throw new Error('No Builds Available')
      const latestBuild = builds
        .filter(({ triggered_workflow, status }) => status === 1 && triggered_workflow === workflow)
        ?.sort((a, b) => moment(b.triggered_at).isSameOrAfter(b.triggered_at))[0]
      if (!latestBuild) throw new Error('No Latest Build')
      const { slug: build_slug, finished_at: build_finished_at, build_number, ...buildProps } = latestBuild
      log.info(`Got latest build, slug: ${build_slug}`)
      const { data: artifacts } = await getBuildArtifacts({ app_slug, build_slug })
      const publicInstallArtifact = artifacts.filter(({ is_public_page_enabled }) => !!is_public_page_enabled)[0]
      const { slug: artifact_slug } = publicInstallArtifact
      log.info(`Got public artifact, slug: ${artifact_slug}`)
      const { data: artifactInfo, } = await getBuildArtifactInfo({ app_slug, build_slug, artifact_slug })
      const { public_install_page_url, artifact_meta: { app_info: { version, version_name } = {} } = {} } = artifactInfo
      log.info(`Got public artifact data, public install link: ${public_install_page_url}`)

      data.push({
        name,
        public_install_page_url,
        build_number,
        version: version || version_name,
        build_finished_at
      })
      successes.push(name)
      log.ok(`Completed ${name}`)
    } catch ({ message }) {
      log.warn(message)
      fails.push(name)
      log.error(`Failed ${name}`)
    }
  }
  if (fails.length === 0) log.ok(`All App data for ${workflow} was successfully captured`)
  if (fails.length !== 0) log.error(`${fails.length}/${apps.length} FAILED\n APPS:\n${fails.join('\n')}`)
  return data
}

async function getAllArtifactsForWorkflow() {
  const uatArtifacts = await getArtifactsForWorkflow({ workflow: 'uat' })
  const qaArtifacts = await getArtifactsForWorkflow({ workflow: 'qa' })
  const data = { uat: uatArtifacts, qa: qaArtifacts }
  fs.writeFileSync('allAppData.json', JSON.stringify(data, null, 2))
  return data
}

const headerMapper = {
  name: 'Name',
  public_install_page_url: 'Public Install Page',
  build_number: 'Build Number',
  version: 'App Version',
  build_finished_at: 'Finished At'
}

async function createMd() {
  const workFlowData = await getAllArtifactsForWorkflow()
  log.info('Captured Information from all workflows')

  let md = []

  md.push(json2md([
    {
      h1: 'WEB-RADR Apps'
    }
  ]))

  for (var key in workFlowData) {
    const data = workFlowData[key]

    md.push(json2md([
      {
        h2: key.toUpperCase(),
      },
      {  
        table: {
          headers: Object.keys(data[0]).map(title => headerMapper[title]),
          rows: data.map((app) => Object.values(app))
        }
      }
    ]))
  }

  log.ok('Completed building markdown')
  fs.writeFileSync(process.env.MD_PATH || 'markdown.md', md.join('\n'))
}

createMd()
