import React from 'react'
import {
  Stack,
  Box,
  Text,
  Heading,
  RadioGroup,
  Flex,
  Divider,
  Icon,
  Stat,
  StatNumber,
  StatLabel,
  useDisclosure,
  StatHelpText,
  useToast,
} from '@chakra-ui/core'
import {useTranslation} from 'react-i18next'
import {useMachine} from '@xstate/react'
import {useRouter} from 'next/router'
import dayjs from 'dayjs'
import {Page} from '../../screens/app/components'
import {
  Avatar,
  ExternalLink,
  FloatDebug,
  Toast,
} from '../../shared/components/components'
import {rem} from '../../shared/theme'
import {
  PrimaryButton,
  SecondaryButton,
  IconButton2,
} from '../../shared/components/button'
import {eitherState, toLocaleDna, toPercent} from '../../shared/utils/utils'
import {
  SmallText,
  VotingBadge,
  VotingOption,
  VotingSkeleton,
} from '../../screens/oracles/components'
import {
  AddFundDrawer,
  VotingStatusBadge,
  VoteDrawer,
  AsideStat,
  VotingInspector,
  VotingResult,
} from '../../screens/oracles/containers'
import {createViewVotingMachine} from '../../screens/oracles/machines'
import {useEpochState} from '../../shared/providers/epoch-context'
import {VotingStatus} from '../../shared/types'
import {useIdentityState} from '../../shared/providers/identity-context'
import {areSameCaseInsensitive, oracleReward} from '../../screens/oracles/utils'
import {
  Table,
  TableCol,
  TableHeaderCol,
  TableRow,
} from '../../shared/components'

export default function ViewVotingPage() {
  const {t, i18n} = useTranslation()

  const toast = useToast()

  const {
    isOpen: isOpenVote,
    onOpen: onOpenVote,
    onClose: onCloseVote,
  } = useDisclosure()

  const {
    isOpen: isOpenAddFund,
    onOpen: onOpenAddFund,
    onClose: onCloseAddFund,
  } = useDisclosure()

  const {
    query: {id},
    push: redirect,
  } = useRouter()

  const {epoch} = useEpochState()

  const identity = useIdentityState()

  const viewMachine = React.useMemo(
    () => createViewVotingMachine(id, epoch, identity.address),
    [epoch, id, identity.address]
  )

  const [current, send] = useMachine(viewMachine, {
    actions: {
      onError: (_, {data: {message}}) => {
        toast({
          status: 'error',
          // eslint-disable-next-line react/display-name
          render: () => <Toast title={message} status="error" />,
        })
      },
    },
  })

  const toDna = toLocaleDna(i18n.language)

  const {
    title,
    desc,
    contractHash,
    issuer,
    status,
    balance: contractBalance = 0,
    votingMinPayment = 0,
    startDate,
    votingDuration = 0,
    publicVotingDuration = 0,
    quorum = 20,
    options = [],
    voteProofsCount,
    votesCount,
    actualVotesCount = votesCount || voteProofsCount,
    finishDate = dayjs(startDate)
      .add(votingDuration, 's')
      .add(publicVotingDuration, 's'),
    prevStatus,
    selectedOption,
    winnerThreshold = 50,
    balanceUpdates,
  } = current.context

  const isLoaded = !current.matches('loading')

  const isMining = current.matches('mining')
  const isMiningFunding = current.matches('mining.funding')

  const sameString = a => b => areSameCaseInsensitive(a, b)

  const eitherIdleState = (...states) =>
    eitherState(current, ...states.map(s => `idle.${s}`.toLowerCase())) ||
    states.some(sameString(status)) ||
    (isMining && states.some(sameString(prevStatus)))

  const reward = oracleReward({
    balance: contractBalance,
    votesCount: actualVotesCount,
    quorum,
  })

  const hasQuorum = votesCount >= quorum
  const canFinish = dayjs().isAfter(dayjs(finishDate)) && hasQuorum

  return (
    <>
      <Page pt={8}>
        <Stack isInline spacing={10} w="full">
          <Box minWidth="lg" maxW="lg">
            <VotingSkeleton isLoaded={isLoaded}>
              <Stack isInline spacing={2} mb={10}>
                <VotingStatusBadge status={status}>
                  {t(status)}
                </VotingStatusBadge>
                <VotingBadge bg="gray.300" color="muted" pl="1/2">
                  <Stack isInline spacing={1} align="center">
                    <Avatar w={5} h={5} address={issuer} />
                    <Text>{issuer}</Text>
                  </Stack>
                </VotingBadge>
              </Stack>
            </VotingSkeleton>
            <Stack spacing={6}>
              <VotingSkeleton isLoaded={isLoaded}>
                <Stack
                  spacing={4}
                  borderRadius="md"
                  bg="gray.50"
                  py={8}
                  px={10}
                >
                  <Heading fontSize={rem(21)} fontWeight={500}>
                    {title}
                  </Heading>
                  <Text lineHeight="tall">{desc}</Text>
                </Stack>
              </VotingSkeleton>

              {eitherIdleState(VotingStatus.Open, VotingStatus.Voted) && (
                <VotingSkeleton isLoaded={isLoaded}>
                  <Box>
                    <Text color="muted" fontSize="sm" mb={3}>
                      {t('Choose an option to vote')}
                    </Text>
                    <RadioGroup
                      defaultValue={selectedOption}
                      onChange={e => {
                        send('SELECT_OPTION', {
                          option: e.target.value,
                        })
                        onOpenVote()
                      }}
                    >
                      {/* eslint-disable-next-line no-shadow */}
                      {options.map(({id, value}) => (
                        <VotingOption
                          key={id}
                          value={id}
                          isDisabled={eitherIdleState(VotingStatus.Voted)}
                          annotation={t('{{count}} min. votes required', {
                            count: toPercent(winnerThreshold / 100),
                          })}
                        >
                          {value}
                        </VotingOption>
                      ))}
                    </RadioGroup>
                  </Box>
                </VotingSkeleton>
              )}

              {eitherIdleState(
                VotingStatus.Counting,
                VotingStatus.Archived
              ) && (
                <VotingSkeleton isLoaded={isLoaded}>
                  <Stack spacing={2}>
                    <Text color="muted" fontSize="sm">
                      {t('Results')}
                    </Text>
                    {actualVotesCount ? (
                      <VotingResult {...current.context} />
                    ) : (
                      <Text
                        bg="gray.50"
                        borderRadius="md"
                        p={2}
                        color="muted"
                        fontSize="sm"
                      >
                        {t('No votes')}
                      </Text>
                    )}
                  </Stack>
                </VotingSkeleton>
              )}

              <VotingSkeleton isLoaded={isLoaded}>
                <Stack spacing={5}>
                  <Box>
                    <Text fontWeight={500}>{t('Recent transactions')}</Text>
                    <ExternalLink
                      href={`https://scan.idena.io/address/${identity.address}/contract/${id}/balanceUpdates`}
                    >
                      {t('See balance updates in Explorer')}
                    </ExternalLink>
                  </Box>
                  <Table style={{tableLayout: 'fixed', fontWeight: 500}}>
                    <thead>
                      <TableRow>
                        <TableHeaderCol>{t('Transaction')}</TableHeaderCol>
                        <TableHeaderCol>{t('Address')}</TableHeaderCol>
                        <TableHeaderCol>{t('Date and time')}</TableHeaderCol>
                        <TableHeaderCol>{t('iDNA value')}</TableHeaderCol>
                      </TableRow>
                    </thead>
                    <tbody>
                      {balanceUpdates.map(
                        ({
                          hash,
                          type,
                          timestamp,
                          from,
                          amount,
                          fee,
                          tips,
                          balanceNew,
                          balanceOld,
                        }) => {
                          const isSent = areSameCaseInsensitive(
                            from,
                            identity.address
                          )
                          return (
                            <TableRow>
                              <TableCol>
                                <Stack isInline>
                                  <Flex
                                    align="center"
                                    justify="center"
                                    bg={isSent ? 'red.012' : 'brandBlue.012'}
                                    color={isSent ? 'red.500' : 'brandBlue.500'}
                                    borderRadius="lg"
                                    minH={8}
                                    minW={8}
                                  >
                                    <Icon
                                      name={`arrow-${isSent ? 'up' : 'down'}`}
                                      size={5}
                                    />
                                  </Flex>
                                  <Box isTruncated>
                                    <Text>
                                      {isSent ? t('Sent') : t('Received')}
                                    </Text>
                                    <SmallText isTruncated>{from}</SmallText>
                                  </Box>
                                </Stack>
                              </TableCol>
                              <TableCol>
                                <Text>{type}</Text>
                                <SmallText isTruncated>{hash}</SmallText>
                              </TableCol>
                              <TableCol>
                                <Text>
                                  {new Date(timestamp).toLocaleString()}
                                </Text>
                              </TableCol>
                              <TableCol>
                                <Text
                                  color={isSent ? 'red.500' : 'brandGray.500'}
                                >
                                  {toLocaleDna(i18n.language, {
                                    signDisplay: 'exceptZero',
                                  })(
                                    (isSent ? -amount : 0) +
                                      (balanceNew ? balanceNew - balanceOld : 0)
                                  )}
                                </Text>
                                <SmallText>{toDna(fee + tips)}</SmallText>
                              </TableCol>
                            </TableRow>
                          )
                        }
                      )}
                    </tbody>
                  </Table>
                </Stack>
              </VotingSkeleton>

              <VotingSkeleton isLoaded={isLoaded}>
                <Flex justify="space-between" align="center">
                  <Stack isInline spacing={2}>
                    {eitherIdleState(VotingStatus.Pending) && (
                      <PrimaryButton
                        isLoading={isMining}
                        loadingText={
                          isMiningFunding ? t('Mining') : t('Launching')
                        }
                        onClick={() => {
                          send('START_VOTING', {from: identity.address})
                        }}
                      >
                        {t('Launch')}
                      </PrimaryButton>
                    )}
                    {eitherIdleState(VotingStatus.Open) && (
                      <PrimaryButton
                        isLoading={isMining}
                        loadingText={
                          isMiningFunding ? t('Mining') : t('Voting')
                        }
                        onClick={() => send('VOTE', {from: identity.address})}
                      >
                        {t('Vote')}
                      </PrimaryButton>
                    )}
                    {eitherIdleState(VotingStatus.Counting) && canFinish && (
                      <PrimaryButton
                        isLoading={isMining}
                        loadingText={
                          isMiningFunding ? t('Mining') : t('Finishing')
                        }
                        onClick={() =>
                          send('FINISH_VOTING', {from: identity.address})
                        }
                      >
                        {t('Finish voting')}
                      </PrimaryButton>
                    )}
                    {eitherIdleState(VotingStatus.Counting) && !hasQuorum && (
                      <PrimaryButton
                        isLoading={isMining}
                        loadingText={
                          isMiningFunding ? t('Mining') : t('Prolongating')
                        }
                        onClick={() =>
                          send('PROLONGATE_VOTING', {from: identity.address})
                        }
                      >
                        {t('Prolongate voting')}
                      </PrimaryButton>
                    )}
                    <SecondaryButton onClick={() => redirect('/oracles/list')}>
                      {t('Close')}
                    </SecondaryButton>
                  </Stack>
                  <Stack isInline spacing={3}>
                    <Divider
                      orientation="vertical"
                      borderColor="gray.300"
                      borderLeft="1px"
                    />
                    <Stack isInline spacing={2} align="center">
                      <Icon
                        name={actualVotesCount >= quorum ? 'user-tick' : 'user'}
                        color="muted"
                        w={4}
                        h={4}
                      />
                      <Text as="span">
                        {t('{{count}} votes', {count: actualVotesCount})}
                      </Text>
                    </Stack>
                  </Stack>
                </Flex>
              </VotingSkeleton>
            </Stack>
          </Box>
          <VotingSkeleton isLoaded={isLoaded} mt={isLoaded ? 0 : 16}>
            <Box mt={20}>
              <Stat mb={8}>
                <StatLabel as="div" color="muted" fontSize="md">
                  <Stack isInline spacing={2} align="center">
                    <Icon name="star" size={4} color="white" />
                    <Text fontWeight={500}>{t('Total prize')}</Text>
                  </Stack>
                </StatLabel>
                <StatNumber fontSize="base" fontWeight={500}>
                  {toDna(contractBalance)}
                </StatNumber>
                <StatHelpText mt={1}>
                  <IconButton2 icon="add-fund" onClick={onOpenAddFund}>
                    {t('Add fund')}
                  </IconButton2>
                </StatHelpText>
              </Stat>
              <Stack spacing={6}>
                <Stat>
                  <StatLabel color="muted" fontSize="md">
                    {t('Lock to vote')}
                  </StatLabel>
                  <StatNumber fontSize="base" fontWeight={500}>
                    {toDna(votingMinPayment)}
                  </StatNumber>
                  <StatHelpText mt={1} color="muted" fontSize="small">
                    {Number(votingMinPayment) > 0
                      ? t(
                          'Deposit will be refunded if your vote matches the majority'
                        )
                      : t('Free voting')}
                  </StatHelpText>
                </Stat>
                <AsideStat
                  label={t('Your reward')}
                  value={reward ? toDna(reward) : '--'}
                />
                <AsideStat
                  label={t('Quorum required')}
                  value={t('{{count}} votes', {count: quorum})}
                />
                <AsideStat
                  label={t('Deadline')}
                  value={new Date(finishDate).toLocaleString()}
                />
              </Stack>
            </Box>
          </VotingSkeleton>
        </Stack>
      </Page>

      <VoteDrawer
        isOpen={isOpenVote}
        onClose={onCloseVote}
        // eslint-disable-next-line no-shadow
        option={options.find(({id}) => id === selectedOption)?.value}
        from={identity.address}
        to={contractHash}
        deposit={votingMinPayment}
        onVote={() => {
          send('VOTE', {from: identity.address})
          onCloseVote()
        }}
      />

      <AddFundDrawer
        isOpen={isOpenAddFund}
        onClose={onCloseAddFund}
        from={issuer}
        to={contractHash}
        available={identity.balance}
        onAddFund={({amount, from}) => {
          send('ADD_FUND', {amount, from})
          onCloseAddFund()
        }}
      />

      <FloatDebug>{current.value}</FloatDebug>

      {global.isDev && (
        <Box position="absolute" top={6} right={6}>
          <VotingInspector {...current.context} />
        </Box>
      )}
    </>
  )
}
