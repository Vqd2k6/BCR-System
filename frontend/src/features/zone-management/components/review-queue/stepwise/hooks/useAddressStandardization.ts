import { useEffect, useMemo, useState } from 'react';
import { evaluateAddressStandard, formatStandardizedAddress168 } from '../utils/residentialAddressStandards';

interface AddressFields {
  houseNumber?: string;
  street?: string;
  ward?: string;
  district?: string;
  standardizedAddress?: unknown;
}

interface Options {
  formState: AddressFields;
  surveyJson: Record<string, unknown>;
  data?: AddressFields & { zoneId?: string; zone_id?: string } | null;
  handleFieldChange: (fieldKey: string, label: string, val: unknown) => void;
}

const asText = (val: unknown): string | undefined => (typeof val === 'string' ? val : undefined);

/** Đánh giá & xác nhận địa chỉ chuẩn hóa 168 ĐVHC (NQ 1685), dùng chung cho Nhà dân và Tòa nhà mẹ. */
export function useAddressStandardization({ formState, surveyJson, data, handleFieldChange }: Options) {
  const zoneId = data?.zoneId || data?.zone_id || asText(surveyJson.zoneId);

  const addressEvaluation = useMemo(() => {
    const rawHn = formState.houseNumber || asText(surveyJson.houseNumber) || asText(data?.houseNumber);
    const rawStreet = formState.street || asText(surveyJson.street) || asText(data?.street);
    const rawWard = formState.ward || asText(surveyJson.ward) || asText(data?.ward);
    const rawDistrict = formState.district || asText(surveyJson.district) || asText(data?.district);

    return evaluateAddressStandard(rawHn, rawStreet, rawWard, rawDistrict, zoneId);
  }, [
    formState.houseNumber,
    formState.street,
    formState.ward,
    formState.district,
    surveyJson.houseNumber,
    surveyJson.street,
    surveyJson.ward,
    surveyJson.district,
    data?.houseNumber,
    data?.street,
    data?.ward,
    data?.district,
    zoneId,
  ]);

  const defaultStandardized168 = useMemo(
    () =>
      formatStandardizedAddress168(
        addressEvaluation.suggested.houseNumber || formState.houseNumber,
        addressEvaluation.suggested.street || formState.street,
        addressEvaluation.suggested.ward || formState.ward
      ),
    [
      addressEvaluation.suggested.houseNumber,
      addressEvaluation.suggested.street,
      addressEvaluation.suggested.ward,
      formState.houseNumber,
      formState.street,
      formState.ward,
    ]
  );

  const activeStandardizedAddress: string =
    typeof formState.standardizedAddress === 'string' && formState.standardizedAddress
      ? formState.standardizedAddress
      : defaultStandardized168;

  const [isAddressAccepted, setIsAddressAccepted] = useState<boolean>(() =>
    Boolean(formState.standardizedAddress || surveyJson.standardizedAddress)
  );

  // Đồng bộ trạng thái đã chấp nhận chuẩn hóa địa chỉ khi dữ liệu tải xong hoặc sau khi lưu Diff
  useEffect(() => {
    if (formState.standardizedAddress || surveyJson.standardizedAddress) {
      setIsAddressAccepted(true);
    }
  }, [formState.standardizedAddress, surveyJson.standardizedAddress]);

  const handleChangeStandardizedAddress = (val: string) => {
    handleFieldChange('standardizedAddress', 'Địa chỉ chuẩn hóa A4 (168 ĐVHC)', val);
  };

  const handleAcceptAddress = (formattedAddress: string) => {
    setIsAddressAccepted(true);
    handleChangeStandardizedAddress(formattedAddress);
  };

  const handleEditAddress = () => {
    setIsAddressAccepted(false);
  };

  return {
    zoneId,
    addressEvaluation,
    activeStandardizedAddress,
    isAddressAccepted,
    handleAcceptAddress,
    handleEditAddress,
    handleChangeStandardizedAddress,
  };
}
