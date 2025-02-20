import * as hashing from '@dcl/hashing'
import { hashV1 } from '@dcl/hashing'
import {
  ContentFileHash,
  Entity,
  EntityContentItemReference,
  EntityId,
  EntityMetadata,
  EntityType,
  EntityVersion,
  Pointer,
  Timestamp
} from 'dcl-catalyst-commons'
import { AuthChain } from 'dcl-crypto'

export class DeploymentBuilder {
  /**
   * Take all the entity's data, build the entity file with it, and calculate its id
   */
  static async buildEntityAndFile({
    type,
    pointers,
    timestamp,
    content,
    metadata
  }: {
    type: EntityType
    pointers: Pointer[]
    timestamp: Timestamp
    content?: EntityContentItemReference[]
    metadata?: EntityMetadata
  }): Promise<{ entity: Entity; entityFile: Uint8Array }> {
    // Make sure that there is at least one pointer
    if (pointers.length === 0) throw new Error(`All entities must have at least one pointer.`)

    const entity = {
      // default version is V3
      version: EntityVersion.V3,
      type,
      pointers,
      timestamp,
      content,
      metadata
    }

    // prevent duplicated file names
    if (content) {
      const usedFilenames = new Set<string>()
      for (let a of content) {
        const lowerCasedFileName = a.file.toLowerCase()
        if (usedFilenames.has(lowerCasedFileName)) {
          throw new Error(
            `Error creating the deployable entity: Decentraland's file system is case insensitive, the file ${JSON.stringify(
              a.file
            )} is repeated`
          )
        }
        usedFilenames.add(lowerCasedFileName)
      }
    }

    const entityFile = new TextEncoder().encode(JSON.stringify(entity))

    const entityId: EntityId = await hashV1(entityFile)
    const entityWithId: Entity = {
      id: entityId,
      ...entity
    }

    return { entity: entityWithId, entityFile }
  }

  /**
   * As part of the deployment process, an entity has to be built. In this method, we are building it, based on the data provided.
   * After the entity is built, the user will have to sign the entity id, to prove they are actually who they say they are.
   */
  static async buildEntity({
    type,
    pointers,
    files,
    metadata,
    timestamp
  }: {
    type: EntityType
    pointers: Pointer[]
    files?: Map<string, Uint8Array>
    metadata?: EntityMetadata
    timestamp?: Timestamp
  }): Promise<DeploymentPreparationData> {
    // Reorder input
    const contentFiles = Array.from(files ? files : []).map(([key, content]) => ({
      key,
      content
    }))

    // Calculate hashes
    const allInfo = await Promise.all(
      contentFiles.map(async ({ key, content }) => ({ key, content, hash: await hashing.hashV1(content) }))
    )
    const hashesByKey: Map<string, ContentFileHash> = new Map(allInfo.map(({ hash, key }) => [key, hash]))
    const filesByHash: Map<ContentFileHash, Uint8Array> = new Map(allInfo.map(({ hash, content }) => [hash, content]))

    return DeploymentBuilder.buildEntityInternal(type, pointers, {
      hashesByKey,
      filesByHash,
      metadata,
      timestamp
    })
  }

  /**
   * In cases where we don't need upload content files, we can simply generate the new entity. We can still use already uploaded hashes on this new entity.
   */
  static async buildEntityWithoutNewFiles({
    type,
    pointers,
    hashesByKey,
    metadata,
    timestamp
  }: {
    type: EntityType
    pointers: Pointer[]
    hashesByKey?: Map<string, ContentFileHash>
    metadata?: EntityMetadata
    timestamp?: Timestamp
  }): Promise<DeploymentPreparationData> {
    return DeploymentBuilder.buildEntityInternal(type, pointers, { hashesByKey, metadata, timestamp })
  }

  private static async buildEntityInternal(
    type: EntityType,
    pointers: Pointer[],
    options?: BuildEntityInternalOptions
  ): Promise<DeploymentPreparationData> {
    // Make sure that there is at least one pointer
    if (pointers.length === 0) {
      throw new Error(`All entities must have at least one pointer.`)
    }

    // Re-organize the hashes
    const hashesByKey: Map<string, ContentFileHash> = options?.hashesByKey ? options?.hashesByKey : new Map()
    const entityContent: EntityContentItemReference[] = Array.from(hashesByKey.entries()).map(([key, hash]) => ({
      file: key,
      hash
    }))

    // Calculate timestamp if necessary
    const timestamp: Timestamp = options?.timestamp ? options?.timestamp : Date.now()

    // Build entity file
    const { entity, entityFile } = await DeploymentBuilder.buildEntityAndFile({
      type,
      pointers,
      timestamp,
      content: entityContent,
      metadata: options?.metadata
    })

    // Add entity file to content files
    const filesByHash: Map<ContentFileHash, Uint8Array> = options?.filesByHash ? options.filesByHash : new Map()
    filesByHash.set(entity.id, entityFile)

    return { files: filesByHash, entityId: entity.id }
  }
}

type BuildEntityInternalOptions = {
  hashesByKey?: Map<string, ContentFileHash>
  filesByHash?: Map<ContentFileHash, Uint8Array>
  metadata?: EntityMetadata
  timestamp?: Timestamp
}

/** This data contains everything necessary for the user to sign, so that then a deployment can be executed */
export type DeploymentPreparationData = {
  entityId: EntityId
  files: Map<ContentFileHash, Uint8Array>
}

export type DeploymentData = DeploymentPreparationData & {
  authChain: AuthChain
}
