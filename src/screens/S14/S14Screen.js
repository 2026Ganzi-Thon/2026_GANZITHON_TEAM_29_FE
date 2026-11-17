import React from 'react';

import RecordView from '../../components/record/RecordView';

export default function S14Screen({ navigation }) {
  return <RecordView navigation={navigation} initialTab="today" />;
}
