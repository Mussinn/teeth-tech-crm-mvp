import type { WorkflowStatus } from '@/src/types/workflow.types';

export type WorkflowStatusIdentity = Pick<
    WorkflowStatus,
    'id' | 'code' | 'name' | 'initial' | 'terminal' | 'review'
>;

export type WorkflowStatusMatch = {
    status: WorkflowStatusIdentity;
    score: number;
    matchedBy: 'code' | 'name';
};

export function normalizeWorkflowStageValue(value: string) {
    return value
        .trim()
        .toLocaleLowerCase()
        .replace(/ё/gu, 'е')
        .replace(/[_\-/]+/gu, ' ')
        .replace(/[^\p{L}\p{N}\s]+/gu, '')
        .replace(/\s+/gu, ' ');
}

function getEditDistance(left: string, right: string) {
    const previous = Array.from(
        { length: right.length + 1 },
        (_, index) => index,
    );

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const current = [leftIndex];

        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            const substitutionCost =
                left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

            current[rightIndex] = Math.min(
                current[rightIndex - 1] + 1,
                previous[rightIndex] + 1,
                previous[rightIndex - 1] + substitutionCost,
            );
        }

        previous.splice(0, previous.length, ...current);
    }

    return previous[right.length];
}

function getSimilarityScore(value: string, candidate: string) {
    const normalizedValue = normalizeWorkflowStageValue(value);
    const normalizedCandidate = normalizeWorkflowStageValue(candidate);

    if (!normalizedValue || !normalizedCandidate) return 0;
    if (normalizedValue === normalizedCandidate) return 100;

    const shorterLength = Math.min(
        normalizedValue.length,
        normalizedCandidate.length,
    );

    if (shorterLength >= 3) {
        if (
            normalizedCandidate.startsWith(normalizedValue) ||
            normalizedValue.startsWith(normalizedCandidate)
        ) {
            return 88;
        }

        if (
            normalizedCandidate.includes(normalizedValue) ||
            normalizedValue.includes(normalizedCandidate)
        ) {
            return 80;
        }
    }

    if (shorterLength < 4) return 0;

    const maxLength = Math.max(
        normalizedValue.length,
        normalizedCandidate.length,
    );
    const distance = getEditDistance(normalizedValue, normalizedCandidate);
    const ratio = 1 - distance / maxLength;

    return ratio >= 0.72 ? Math.round(ratio * 100) : 0;
}

function getBestStatusScore(
    code: string,
    name: string,
    status: WorkflowStatusIdentity,
) {
    const codeScore = getSimilarityScore(code, status.code);
    const nameScore = getSimilarityScore(name, status.name);

    return codeScore >= nameScore
        ? { score: codeScore, matchedBy: 'code' as const }
        : { score: nameScore, matchedBy: 'name' as const };
}

export function findSimilarWorkflowStatus(
    stage: { code: string; name: string },
    statuses: WorkflowStatusIdentity[],
) {
    return statuses
        .map((status) => ({
            status,
            ...getBestStatusScore(stage.code, stage.name, status),
        }))
        .filter((match) => match.score >= 72)
        .sort((left, right) => right.score - left.score)[0];
}

export function searchWorkflowStatuses(
    query: string,
    statuses: WorkflowStatusIdentity[],
    limit = 8,
): WorkflowStatusMatch[] {
    const normalizedQuery = normalizeWorkflowStageValue(query);

    if (!normalizedQuery) {
        return statuses
            .slice(0, limit)
            .map((status) => ({ status, score: 1, matchedBy: 'name' }));
    }

    return statuses
        .map((status) => {
            const codeScore = getSimilarityScore(query, status.code);
            const nameScore = getSimilarityScore(query, status.name);

            return codeScore >= nameScore
                ? { status, score: codeScore, matchedBy: 'code' as const }
                : { status, score: nameScore, matchedBy: 'name' as const };
        })
        .filter((match) => match.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);
}

export function isProtectedWorkflowStatus(status: WorkflowStatusIdentity) {
    return status.initial || status.terminal || status.review;
}
