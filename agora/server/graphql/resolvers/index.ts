import { queryResolvers } from './query'
import { mutationResolvers } from './mutation'
import { typeResolvers } from './types'

export const resolvers = {
  ...queryResolvers,
  ...mutationResolvers,
  ...typeResolvers
}
