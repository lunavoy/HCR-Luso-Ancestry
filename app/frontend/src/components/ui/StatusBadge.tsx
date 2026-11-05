import { processingStatusLabels, verificationStatusLabels } from '../../utils/format'
import type { ProcessingStatus, VerificationStatus } from '../../types/domain'

export function StatusBadge({ status }: { status: ProcessingStatus | VerificationStatus }) {
  const label = status in processingStatusLabels
    ? processingStatusLabels[status as ProcessingStatus]
    : verificationStatusLabels[status as VerificationStatus]

  return <span className={`status-badge status-${status}`}>{label}</span>
}
