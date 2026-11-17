import React from 'react';

import RecordView from '../../components/record/RecordView';

export default function S15Screen({ navigation }) {
  return <RecordView navigation={navigation} initialTab="week" />;
}
