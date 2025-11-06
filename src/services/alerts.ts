export interface AlertItem {
  id: string;
  symbol: string;
  channels: string[];
  rule: {
    price?: {
      operator: '>=' | '<=';
      target: number;
    };
  };
  active: boolean;
}

export interface CreateAlertPayload {
  symbol: string;
  channels: string[];
  rule: {
    price?: {
      operator: '>=' | '<=';
      target: number;
    };
  };
}

const buildHeaders = (apiKey?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
};

export const fetchAlerts = async (baseUrl: string, apiKey?: string): Promise<AlertItem[]> => {
  const response = await fetch(`${baseUrl}/v1/alerts`, {
    headers: buildHeaders(apiKey)
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch alerts: ${response.statusText}`);
  }
  return (await response.json()) as AlertItem[];
};

export const createAlert = async (
  baseUrl: string,
  apiKey: string | undefined,
  payload: CreateAlertPayload
): Promise<AlertItem> => {
  const response = await fetch(`${baseUrl}/v1/alerts`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Failed to create alert: ${response.statusText}`);
  }
  return (await response.json()) as AlertItem;
};

export const deleteAlert = async (
  baseUrl: string,
  apiKey: string | undefined,
  id: string
): Promise<void> => {
  const response = await fetch(`${baseUrl}/v1/alerts/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(apiKey)
  });
  if (!response.ok) {
    throw new Error(`Failed to delete alert: ${response.statusText}`);
  }
};
